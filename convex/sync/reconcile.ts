/**
 * Reconciliación one-shot Directus → Convex.
 *
 * Ejecutar UNA SOLA VEZ tras añadir el campo `directusId` al schema. Para cada
 * categoría/ejercicio existente en Directus busca su gemelo en Convex por
 * nombre normalizado (lowercase + trim) y le estampa el `directusId`. Para la
 * relación M2M, resuelve el par `(ejercicioConvexId, categoriaConvexId)` y
 * estampa el `directusId` de la fila puente. Crea nuevos registros en Convex
 * cuando no haya match (admin pudo haber añadido cosas en Directus durante el
 * gap).
 *
 * Cómo ejecutar:
 *   npx convex run sync/reconcile:reconcileFromDirectus
 *   npx convex run sync/reconcile:reconcileFromDirectus --prod
 *
 * Idempotente: si un registro ya tiene `directusId` se ignora (no se duplica).
 * Casos ambiguos (varios Convex con el mismo nombre, todos sin `directusId`)
 * se loguean y se dejan sin tocar para resolución manual.
 *
 * Tras ejecutar, el cron diario `directus-catalog-sync` puede tomar el relevo
 * con sync incremental por `date_updated`.
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  fetchCategoriasUpdatedSince,
  fetchEjerciciosCategoriasUpdatedSince,
  fetchEjerciciosUpdatedSince,
  isoToMs,
  toNumberOrUndefined,
} from "./directusClient";

export const reconcileFromDirectus = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    // Pull total (sinceMs = 0 → sin filtro)
    const dxCats = await fetchCategoriasUpdatedSince(0);
    const dxEx = await fetchEjerciciosUpdatedSince(0);
    const dxRel = await fetchEjerciciosCategoriasUpdatedSince(0);

    // ----- Categorías ------------------------------------------------------
    const catItems = dxCats
      .filter((c) => c.nombre_categoria != null)
      .map((c) => ({
        directusId: c.id_categoria,
        nombreCategoria: c.nombre_categoria!.trim(),
        directusUpdatedAt: isoToMs(c.date_updated),
      }));
    const catRes = await ctx.runMutation(
      internal.sync.internal.linkCategoriesByName,
      { items: catItems },
    );
    console.info("[reconcile/categorias]", {
      directusTotal: catItems.length,
      ...catRes,
    });

    // ----- Ejercicios ------------------------------------------------------
    const exItems = dxEx
      .filter((e) => e.nombre_ejercicio != null)
      .map((e) => ({
        directusId: e.id_ejercicio,
        nombreEjercicio: e.nombre_ejercicio!.trim(),
        descripcion: e.descripcion ?? undefined,
        seriesDefecto: toNumberOrUndefined(e.series_defecto),
        repeticionesDefecto: toNumberOrUndefined(e.repeticiones_defecto),
        video: e.video ?? undefined,
        portada: e.portada ?? undefined,
        directusUpdatedAt: isoToMs(e.date_updated),
      }));
    const exRes = await ctx.runMutation(
      internal.sync.internal.linkExercisesByName,
      { items: exItems },
    );
    console.info("[reconcile/ejercicios]", {
      directusTotal: exItems.length,
      ...exRes,
    });

    // ----- Relación M2M ----------------------------------------------------
    const relItems = dxRel
      .filter(
        (r) =>
          r.ejercicios_id_ejercicio != null && r.categorias_id_categoria != null,
      )
      .map((r) => ({
        directusId: r.id,
        directusEjercicioId: r.ejercicios_id_ejercicio!,
        directusCategoriaId: r.categorias_id_categoria!,
      }));
    const relRes = await ctx.runMutation(
      internal.sync.internal.linkExerciseCategoriesByPair,
      { items: relItems },
    );
    console.info("[reconcile/relaciones]", {
      directusTotal: relItems.length,
      ...relRes,
    });

    // Bootstrap del estado: la próxima ejecución del cron arranca con el
    // timestamp más alto que hemos visto, para evitar reprocesar todo.
    const nowMs = Date.now();
    const maxCatTs = Math.max(0, ...catItems.map((i) => i.directusUpdatedAt));
    const maxExTs = Math.max(0, ...exItems.map((i) => i.directusUpdatedAt));
    const maxRelTs = Math.max(
      0,
      ...dxRel.map((r) => isoToMs(r.date_updated)),
    );

    await ctx.runMutation(internal.sync.internal.recordRun, {
      collection: "categorias",
      lastSyncedAt: maxCatTs,
      lastRunAt: nowMs,
      lastRunStatus: "ok",
      itemsCreated: catRes.createdMissing,
      itemsUpdated: catRes.matched,
      itemsArchived: 0,
    });
    await ctx.runMutation(internal.sync.internal.recordRun, {
      collection: "ejercicios",
      lastSyncedAt: maxExTs,
      lastRunAt: nowMs,
      lastRunStatus: "ok",
      itemsCreated: exRes.createdMissing,
      itemsUpdated: exRes.matched,
      itemsArchived: 0,
    });
    await ctx.runMutation(internal.sync.internal.recordRun, {
      collection: "ejercicios_categorias",
      lastSyncedAt: maxRelTs,
      lastRunAt: nowMs,
      lastRunStatus: "ok",
      itemsCreated: relRes.createdMissing,
      itemsUpdated: relRes.matched,
      itemsArchived: 0,
    });

    // No devolvemos nada (los stats se loguean) — evita ciclos de inferencia TS
    // entre la action y los handlers de las mutations a las que llama.
  },
});
