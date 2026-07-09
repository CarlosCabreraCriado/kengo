/**
 * Action principal de sincronización Directus → Convex.
 *
 * Disparada por:
 *   - Cron diario `directus-catalog-sync` (04:00 UTC, ver `convex/crons.ts`).
 *   - Manualmente: `npx convex run sync/actions:syncFromDirectus`.
 *
 * Flujo (orden importa: padres antes que hijos):
 *   1. Categorías incrementales por `date_updated`.
 *   2. Ejercicios incrementales por `date_updated`.
 *   3. Relación M2M incremental por `date_updated`.
 *   4. Detección de borrados:
 *      - Ejercicios faltantes → `archivado = true` (soft delete).
 *      - M2M faltantes → eliminar fila (no rompe FKs).
 *
 * Cada colección persiste su propio estado en `directusSyncState`. Si alguno
 * falla, registra `lastRunStatus = "error"` con `lastError` y NO actualiza
 * `lastSyncedAt` (la próxima ejecución reintenta desde el mismo punto).
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  effectiveUpdatedMs,
  fetchAliveEjercicioCategoriaIds,
  fetchAliveEjercicioIds,
  fetchCategoriasUpdatedSince,
  fetchEjerciciosCategoriasUpdatedSince,
  fetchEjerciciosUpdatedSince,
  toNumberOrUndefined,
} from "./directusClient";

export const syncFromDirectus = internalAction({
  args: {},
  handler: async (ctx) => {
    const runAt = Date.now();
    const summary = {
      categorias: { created: 0, updated: 0, archived: 0 },
      ejercicios: { created: 0, updated: 0, archived: 0 },
      relaciones: { created: 0, updated: 0, archived: 0, skipped: 0 },
      errors: [] as string[],
    };

    // ----- 1. Categorías ---------------------------------------------------
    try {
      const stCat = await ctx.runQuery(internal.sync.internal.getState, {
        collection: "categorias",
      });
      const since = stCat?.lastSyncedAt ?? 0;
      const dxCats = await fetchCategoriasUpdatedSince(since);
      const items = dxCats
        .filter((c) => c.nombre_categoria != null)
        .map((c) => ({
          directusId: c.id_categoria,
          nombreCategoria: c.nombre_categoria!.trim(),
          directusUpdatedAt: effectiveUpdatedMs(c),
        }));

      const res = await ctx.runMutation(internal.sync.internal.upsertCategories, {
        items,
      });
      summary.categorias.created = res.created;
      summary.categorias.updated = res.updated;

      const newSince = Math.max(since, res.maxTs || since);
      await ctx.runMutation(internal.sync.internal.recordRun, {
        collection: "categorias",
        lastSyncedAt: newSince,
        lastRunAt: runAt,
        lastRunStatus: "ok",
        lastError: undefined,
        itemsCreated: res.created,
        itemsUpdated: res.updated,
        itemsArchived: 0,
      });
      console.info("[sync/categorias]", { since, fetched: items.length, ...res });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`categorias: ${msg}`);
      console.error("[sync/categorias] error", err);
      await ctx.runMutation(internal.sync.internal.recordRun, {
        collection: "categorias",
        lastRunAt: runAt,
        lastRunStatus: "error",
        lastError: msg.slice(0, 500),
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsArchived: 0,
      });
    }

    // ----- 2. Ejercicios ---------------------------------------------------
    try {
      const stEx = await ctx.runQuery(internal.sync.internal.getState, {
        collection: "ejercicios",
      });
      const since = stEx?.lastSyncedAt ?? 0;
      const dxEx = await fetchEjerciciosUpdatedSince(since);
      const items = dxEx
        .filter((e) => e.nombre_ejercicio != null)
        .map((e) => ({
          directusId: e.id_ejercicio,
          nombreEjercicio: e.nombre_ejercicio!.trim(),
          descripcion: e.descripcion ?? undefined,
          // Normaliza el toggle booleano de Directus al enum interno.
          tipo: (e.es_por_duracion ? "duracion" : "repeticiones") as
            | "duracion"
            | "repeticiones",
          seriesDefecto: toNumberOrUndefined(e.series_defecto),
          repeticionesDefecto: toNumberOrUndefined(e.repeticiones_defecto),
          duracionDefectoSeg: toNumberOrUndefined(e.duracion_defecto),
          video: e.video ?? undefined,
          portada: e.portada ?? undefined,
          directusUpdatedAt: effectiveUpdatedMs(e),
        }));

      const res = await ctx.runMutation(internal.sync.internal.upsertExercises, {
        items,
      });
      summary.ejercicios.created = res.created;
      summary.ejercicios.updated = res.updated;

      // Soft-delete: archivar ejercicios cuyo directusId ya no exista en Directus.
      const aliveIds = await fetchAliveEjercicioIds();
      const arch = await ctx.runMutation(
        internal.sync.internal.archiveMissingExercises,
        { aliveDirectusIds: aliveIds },
      );
      summary.ejercicios.archived = arch.archived;

      const newSince = Math.max(since, res.maxTs || since);
      await ctx.runMutation(internal.sync.internal.recordRun, {
        collection: "ejercicios",
        lastSyncedAt: newSince,
        lastRunAt: runAt,
        lastRunStatus: "ok",
        lastError: undefined,
        itemsCreated: res.created,
        itemsUpdated: res.updated,
        itemsArchived: arch.archived,
      });
      console.info("[sync/ejercicios]", {
        since,
        fetched: items.length,
        ...res,
        archived: arch.archived,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`ejercicios: ${msg}`);
      console.error("[sync/ejercicios] error", err);
      await ctx.runMutation(internal.sync.internal.recordRun, {
        collection: "ejercicios",
        lastRunAt: runAt,
        lastRunStatus: "error",
        lastError: msg.slice(0, 500),
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsArchived: 0,
      });
    }

    // ----- 3. Relación M2M -------------------------------------------------
    try {
      const stRel = await ctx.runQuery(internal.sync.internal.getState, {
        collection: "ejercicios_categorias",
      });
      const since = stRel?.lastSyncedAt ?? 0;
      const dxRel = await fetchEjerciciosCategoriasUpdatedSince(since);
      const items = dxRel
        .filter(
          (r) =>
            r.ejercicios_id_ejercicio != null && r.categorias_id_categoria != null,
        )
        .map((r) => ({
          directusId: r.id,
          directusEjercicioId: r.ejercicios_id_ejercicio!,
          directusCategoriaId: r.categorias_id_categoria!,
          directusUpdatedAt: effectiveUpdatedMs(r),
        }));

      const res = await ctx.runMutation(
        internal.sync.internal.upsertExerciseCategories,
        { items },
      );
      summary.relaciones.created = res.created;
      summary.relaciones.updated = res.updated;
      summary.relaciones.skipped = res.skipped;

      // Borrar relaciones cuyo `directusId` ya no exista en Directus.
      const aliveRelIds = await fetchAliveEjercicioCategoriaIds();
      const removed = await ctx.runMutation(
        internal.sync.internal.removeMissingExerciseCategories,
        { aliveDirectusIds: aliveRelIds },
      );
      summary.relaciones.archived = removed.removed;

      const newSince = Math.max(since, res.maxTs || since);
      await ctx.runMutation(internal.sync.internal.recordRun, {
        collection: "ejercicios_categorias",
        lastSyncedAt: newSince,
        lastRunAt: runAt,
        lastRunStatus: "ok",
        lastError: undefined,
        itemsCreated: res.created,
        itemsUpdated: res.updated,
        itemsArchived: removed.removed,
      });
      console.info("[sync/relaciones]", {
        since,
        fetched: items.length,
        ...res,
        removed: removed.removed,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`ejercicios_categorias: ${msg}`);
      console.error("[sync/relaciones] error", err);
      await ctx.runMutation(internal.sync.internal.recordRun, {
        collection: "ejercicios_categorias",
        lastRunAt: runAt,
        lastRunStatus: "error",
        lastError: msg.slice(0, 500),
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsArchived: 0,
      });
    }

    console.info("[sync] resumen", summary);
    return summary;
  },
});
