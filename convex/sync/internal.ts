/**
 * Mutations y queries internas usadas por la action `syncFromDirectus`
 * (cron diario) y por la action one-shot `reconcileFromDirectus`.
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
import type { Doc, Id } from "../_generated/dataModel";

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
    lastSyncedAt: v.number(),
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

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSyncedAt: args.lastSyncedAt,
        lastRunAt: args.lastRunAt,
        lastRunStatus: args.lastRunStatus,
        lastError: args.lastError,
        itemsCreated: args.itemsCreated,
        itemsUpdated: args.itemsUpdated,
        itemsArchived: args.itemsArchived,
      });
    } else {
      await ctx.db.insert("directusSyncState", args);
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

// ============================================================================
// Reconciliación inicial: stamp directusId en filas ya migradas
// ============================================================================

function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export const linkCategoriesByName = internalMutation({
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
    const all = await ctx.db.query("categories").collect();
    const byName = new Map<string, Doc<"categories">[]>();
    for (const c of all) {
      const k = normalize(c.nombreCategoria);
      const arr = byName.get(k) ?? [];
      arr.push(c);
      byName.set(k, arr);
    }

    let matched = 0;
    let createdMissing = 0;
    let alreadyLinked = 0;
    const ambiguous: { directusId: number; nombre: string; convexIds: Id<"categories">[] }[] = [];

    for (const item of args.items) {
      const candidates = byName.get(normalize(item.nombreCategoria)) ?? [];
      const unlinked = candidates.filter((c) => c.directusId == null);
      const alreadyForThis = candidates.find((c) => c.directusId === item.directusId);

      if (alreadyForThis) {
        alreadyLinked++;
        continue;
      }

      if (unlinked.length === 1) {
        await ctx.db.patch(unlinked[0]!._id, {
          directusId: item.directusId,
          directusUpdatedAt: item.directusUpdatedAt,
        });
        matched++;
      } else if (unlinked.length === 0) {
        await ctx.db.insert("categories", {
          nombreCategoria: item.nombreCategoria,
          directusId: item.directusId,
          directusUpdatedAt: item.directusUpdatedAt,
        });
        createdMissing++;
      } else {
        ambiguous.push({
          directusId: item.directusId,
          nombre: item.nombreCategoria,
          convexIds: unlinked.map((c) => c._id),
        });
      }
    }

    if (ambiguous.length > 0) {
      console.warn("[reconcile/categorias] ambiguos por nombre", ambiguous);
    }
    return { matched, createdMissing, alreadyLinked, ambiguous: ambiguous.length };
  },
});

export const linkExercisesByName = internalMutation({
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
    const all = await ctx.db.query("exercises").collect();
    const byName = new Map<string, Doc<"exercises">[]>();
    for (const e of all) {
      const k = normalize(e.nombreEjercicio);
      const arr = byName.get(k) ?? [];
      arr.push(e);
      byName.set(k, arr);
    }

    let matched = 0;
    let createdMissing = 0;
    let alreadyLinked = 0;
    const ambiguous: { directusId: number; nombre: string; convexIds: Id<"exercises">[] }[] = [];

    for (const item of args.items) {
      const candidates = byName.get(normalize(item.nombreEjercicio)) ?? [];
      const alreadyForThis = candidates.find((c) => c.directusId === item.directusId);
      if (alreadyForThis) {
        alreadyLinked++;
        continue;
      }
      const unlinked = candidates.filter((c) => c.directusId == null);

      if (unlinked.length === 1) {
        await ctx.db.patch(unlinked[0]!._id, {
          directusId: item.directusId,
          directusUpdatedAt: item.directusUpdatedAt,
          archivado: false,
        });
        matched++;
      } else if (unlinked.length === 0) {
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
        createdMissing++;
      } else {
        ambiguous.push({
          directusId: item.directusId,
          nombre: item.nombreEjercicio,
          convexIds: unlinked.map((c) => c._id),
        });
      }
    }

    if (ambiguous.length > 0) {
      console.warn("[reconcile/ejercicios] ambiguos por nombre", ambiguous);
    }
    return { matched, createdMissing, alreadyLinked, ambiguous: ambiguous.length };
  },
});

export const linkExerciseCategoriesByPair = internalMutation({
  args: {
    items: v.array(
      v.object({
        directusId: v.number(),
        directusEjercicioId: v.number(),
        directusCategoriaId: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let matched = 0;
    let createdMissing = 0;
    let alreadyLinked = 0;
    let skipped = 0;

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
        skipped++;
        continue;
      }

      const alreadyForThis = await ctx.db
        .query("exerciseCategories")
        .withIndex("by_directusId", (q) => q.eq("directusId", item.directusId))
        .unique();
      if (alreadyForThis) {
        alreadyLinked++;
        continue;
      }

      const existingPair = await ctx.db
        .query("exerciseCategories")
        .withIndex("by_exerciseId", (q) => q.eq("exerciseId", exercise._id))
        .filter((q) => q.eq(q.field("categoryId"), category._id))
        .first();

      if (existingPair) {
        await ctx.db.patch(existingPair._id, { directusId: item.directusId });
        matched++;
      } else {
        await ctx.db.insert("exerciseCategories", {
          exerciseId: exercise._id,
          categoryId: category._id,
          directusId: item.directusId,
        });
        createdMissing++;
      }
    }

    return { matched, createdMissing, alreadyLinked, skipped };
  },
});
