/**
 * Mutations y queries internas usadas por la action `syncFromDirectus`
 * (cron diario en `convex/crons.ts`).
 *
 * Decisiones:
 * - Lookup de filas existentes via índice `by_directusId` (O(log n)).
 * - Soft-delete: si un ejercicio Directus desaparece, marcamos `archivado=true`.
 *   Re-aparece en Directus → des-archivamos en el siguiente upsert.
 * - M2M: si la fila Directus referencia un ejercicio o categoría que aún no
 *   tiene `directusId` en Convex, se omite y se loguea (debería resolverse
 *   en la próxima vuelta del cron, cuando categorías/ejercicios se hayan
 *   procesado primero).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

// ============================================================================
// Estado de sincronización
// ============================================================================

export const getState = internalQuery({
  args: {
    collection: v.union(
      v.literal("ejercicios"),
      v.literal("categorias"),
      v.literal("ejercicios_categorias"),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("directusSyncState")
      .withIndex("by_collection", (q) => q.eq("collection", args.collection))
      .unique();
  },
});

export const recordRun = internalMutation({
  args: {
    collection: v.union(
      v.literal("ejercicios"),
      v.literal("categorias"),
      v.literal("ejercicios_categorias"),
    ),
    // Optional: en runs con error, los callers omiten este campo para
    // **preservar** el `lastSyncedAt` previo y reintentar desde el mismo punto.
    lastSyncedAt: v.optional(v.number()),
    lastRunAt: v.number(),
    lastRunStatus: v.union(v.literal("ok"), v.literal("error")),
    lastError: v.optional(v.string()),
    itemsCreated: v.number(),
    itemsUpdated: v.number(),
    itemsArchived: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("directusSyncState")
      .withIndex("by_collection", (q) => q.eq("collection", args.collection))
      .unique();

    const base = {
      lastRunAt: args.lastRunAt,
      lastRunStatus: args.lastRunStatus,
      lastError: args.lastError,
      itemsCreated: args.itemsCreated,
      itemsUpdated: args.itemsUpdated,
      itemsArchived: args.itemsArchived,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...base,
        ...(args.lastSyncedAt !== undefined
          ? { lastSyncedAt: args.lastSyncedAt }
          : {}),
      });
    } else {
      await ctx.db.insert("directusSyncState", {
        collection: args.collection,
        lastSyncedAt: args.lastSyncedAt ?? 0,
        ...base,
      });
    }
  },
});

// ============================================================================
// Upsert: categorías
// ============================================================================

export const upsertCategories = internalMutation({
  args: {
    items: v.array(
      v.object({
        directusId: v.number(),
        nombreCategoria: v.string(),
        directusUpdatedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;
    let maxTs = 0;

    for (const item of args.items) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_directusId", (q) => q.eq("directusId", item.directusId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          nombreCategoria: item.nombreCategoria,
          directusUpdatedAt: item.directusUpdatedAt,
        });
        updated++;
      } else {
        await ctx.db.insert("categories", {
          nombreCategoria: item.nombreCategoria,
          directusId: item.directusId,
          directusUpdatedAt: item.directusUpdatedAt,
        });
        created++;
      }

      if (item.directusUpdatedAt > maxTs) maxTs = item.directusUpdatedAt;
    }

    return { created, updated, maxTs };
  },
});

// ============================================================================
// Upsert: ejercicios
// ============================================================================

export const upsertExercises = internalMutation({
  args: {
    items: v.array(
      v.object({
        directusId: v.number(),
        nombreEjercicio: v.string(),
        descripcion: v.optional(v.string()),
        seriesDefecto: v.optional(v.number()),
        repeticionesDefecto: v.optional(v.number()),
        video: v.optional(v.string()),
        portada: v.optional(v.string()),
        directusUpdatedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;
    let maxTs = 0;

    for (const item of args.items) {
      const existing = await ctx.db
        .query("exercises")
        .withIndex("by_directusId", (q) => q.eq("directusId", item.directusId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          nombreEjercicio: item.nombreEjercicio,
          descripcion: item.descripcion,
          seriesDefecto: item.seriesDefecto,
          repeticionesDefecto: item.repeticionesDefecto,
          video: item.video,
          portada: item.portada,
          directusUpdatedAt: item.directusUpdatedAt,
          archivado: false,
        });
        updated++;
      } else {
        await ctx.db.insert("exercises", {
          nombreEjercicio: item.nombreEjercicio,
          descripcion: item.descripcion,
          seriesDefecto: item.seriesDefecto,
          repeticionesDefecto: item.repeticionesDefecto,
          video: item.video,
          portada: item.portada,
          directusId: item.directusId,
          directusUpdatedAt: item.directusUpdatedAt,
          archivado: false,
        });
        created++;
      }

      if (item.directusUpdatedAt > maxTs) maxTs = item.directusUpdatedAt;
    }

    return { created, updated, maxTs };
  },
});

// ============================================================================
// Upsert: relación ejercicios↔categorías (M2M)
// ============================================================================

export const upsertExerciseCategories = internalMutation({
  args: {
    items: v.array(
      v.object({
        directusId: v.number(),
        directusEjercicioId: v.number(),
        directusCategoriaId: v.number(),
        directusUpdatedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let maxTs = 0;

    for (const item of args.items) {
      const exercise = await ctx.db
        .query("exercises")
        .withIndex("by_directusId", (q) =>
          q.eq("directusId", item.directusEjercicioId),
        )
        .unique();
      const category = await ctx.db
        .query("categories")
        .withIndex("by_directusId", (q) =>
          q.eq("directusId", item.directusCategoriaId),
        )
        .unique();

      if (!exercise || !category) {
        console.warn("[sync] M2M skipped (missing parent)", {
          relDirectusId: item.directusId,
          ejercicioOk: !!exercise,
          categoriaOk: !!category,
        });
        skipped++;
        continue;
      }

      const existing = await ctx.db
        .query("exerciseCategories")
        .withIndex("by_directusId", (q) => q.eq("directusId", item.directusId))
        .unique();

      if (existing) {
        if (
          existing.exerciseId !== exercise._id ||
          existing.categoryId !== category._id
        ) {
          await ctx.db.patch(existing._id, {
            exerciseId: exercise._id,
            categoryId: category._id,
          });
          updated++;
        }
      } else {
        await ctx.db.insert("exerciseCategories", {
          exerciseId: exercise._id,
          categoryId: category._id,
          directusId: item.directusId,
        });
        created++;
      }

      // Solo avanzamos `maxTs` con filas efectivamente upserteadas. Si la fila
      // fue skipped por padre ausente, el `continue` ya nos llevó al siguiente
      // item y este timestamp queda fuera de `lastSyncedAt`, garantizando
      // reintento en el próximo cron.
      if (item.directusUpdatedAt > maxTs) maxTs = item.directusUpdatedAt;
    }

    return { created, updated, skipped, maxTs };
  },
});

// ============================================================================
// Soft-delete por set difference
// ============================================================================

export const archiveMissingExercises = internalMutation({
  args: { aliveDirectusIds: v.array(v.number()) },
  handler: async (ctx, args) => {
    const aliveSet = new Set(args.aliveDirectusIds);
    const all = await ctx.db.query("exercises").collect();

    let archived = 0;
    for (const ex of all) {
      if (ex.directusId == null) continue; // sin link → ignorar
      if (ex.archivado === true) continue;
      if (aliveSet.has(ex.directusId)) continue;
      await ctx.db.patch(ex._id, { archivado: true });
      archived++;
    }
    return { archived };
  },
});

/** Borra filas M2M cuyo `directusId` ya no existe en Directus.
 *  M2M es seguro borrar (no rompe FKs): si la categoría se quita en Directus,
 *  el ejercicio simplemente deja de aparecer en esa categoría. */
export const removeMissingExerciseCategories = internalMutation({
  args: { aliveDirectusIds: v.array(v.number()) },
  handler: async (ctx, args) => {
    const aliveSet = new Set(args.aliveDirectusIds);
    const all = await ctx.db.query("exerciseCategories").collect();

    let removed = 0;
    for (const rel of all) {
      if (rel.directusId == null) continue;
      if (aliveSet.has(rel.directusId)) continue;
      await ctx.db.delete(rel._id);
      removed++;
    }
    return { removed };
  },
});
