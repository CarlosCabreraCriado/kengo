import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";

/**
 * Helper: enriquece ejercicios con sus nombres de categoría.
 * Carga todas las relaciones y categorías en 2 queries (sin N+1).
 */
async function enrichWithCategories(
  ctx: { db: { query: any; get: any } },
  exercises: Doc<"exercises">[],
) {
  if (exercises.length === 0) return [];

  const allExCats = await ctx.db.query("exerciseCategories").collect();
  const allCats = await ctx.db.query("categories").collect();

  const catMap = new Map<string, string>();
  for (const c of allCats) {
    catMap.set(c._id, c.nombreCategoria);
  }

  const exCatMap = new Map<string, string[]>();
  for (const ec of allExCats) {
    const name = catMap.get(ec.categoryId);
    if (name) {
      const arr = exCatMap.get(ec.exerciseId) ?? [];
      arr.push(name);
      exCatMap.set(ec.exerciseId, arr);
    }
  }

  return exercises.map((e) => ({
    ...e,
    categorias: exCatMap.get(e._id) ?? [],
  }));
}

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("categories").collect();
  },
});

export const listExercises = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let exercises: Doc<"exercises">[];

    if (args.search && args.search.trim().length > 0) {
      exercises = await ctx.db
        .query("exercises")
        .withSearchIndex("search_nombre", (q) =>
          q.search("nombreEjercicio", args.search!),
        )
        .collect();
    } else {
      exercises = await ctx.db.query("exercises").collect();
    }

    // Excluir archivados del catálogo. `getExerciseById` los sigue resolviendo
    // para que sigan siendo visibles dentro de planes/rutinas existentes.
    exercises = exercises.filter((e) => e.archivado !== true);

    return await enrichWithCategories(ctx, exercises);
  },
});

export const listFavorites = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    if (!user) return [];

    const favorites = await ctx.db
      .query("exerciseFavorites")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return favorites.map((f) => f.exerciseId);
  },
});

export const getExerciseById = query({
  args: { exerciseId: v.id("exercises") },
  handler: async (ctx, args) => {
    const exercise = await ctx.db.get(args.exerciseId);
    if (!exercise) return null;
    const enriched = await enrichWithCategories(ctx, [exercise]);
    return enriched[0];
  },
});
