import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";

/**
 * Helper: enriquece los ejercicios de una rutina con datos completos del ejercicio y sus categorías.
 */
async function enrichRoutineExercises(
  ctx: { db: { query: any; get: any } },
  routineExercises: Doc<"routineExercises">[],
) {
  if (routineExercises.length === 0) return [];

  // Cargar todas las categorías y relaciones (patrón de exercises/queries.ts)
  const allCats = await ctx.db.query("categories").collect();
  const allExCats = await ctx.db.query("exerciseCategories").collect();

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

  const enriched = [];
  for (const re of routineExercises) {
    const exercise = await ctx.db.get(re.exerciseId);
    enriched.push({
      ...re,
      ejercicio: exercise
        ? {
            ...exercise,
            categorias: exCatMap.get(exercise._id) ?? [],
          }
        : null,
    });
  }

  return enriched;
}

export const list = query({
  args: {
    visibilidad: v.optional(
      v.union(v.literal("privado"), v.literal("clinica")),
    ),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    if (!user) return [];

    let routines: Doc<"routines">[];

    if (args.visibilidad === "privado") {
      routines = await ctx.db
        .query("routines")
        .withIndex("by_autorId", (q) => q.eq("autorId", user._id))
        .collect();
    } else if (args.visibilidad === "clinica") {
      routines = await getClinicRoutines(ctx, user._id);
    } else {
      // Todas: propias + las de mi clínica
      const own = await ctx.db
        .query("routines")
        .withIndex("by_autorId", (q) => q.eq("autorId", user._id))
        .collect();

      const clinicRoutines = await getClinicRoutines(ctx, user._id);

      const ownIds = new Set(own.map((r: Doc<"routines">) => r._id));
      routines = [
        ...own,
        ...clinicRoutines.filter((r: Doc<"routines">) => !ownIds.has(r._id)),
      ];
    }

    // Filtro de búsqueda por nombre (client-side sobre el resultado)
    if (args.search && args.search.trim().length > 0) {
      const term = args.search.trim().toLowerCase();
      routines = routines.filter((r) =>
        r.nombre.toLowerCase().includes(term),
      );
    }

    return routines;
  },
});

/**
 * Helper: obtiene rutinas de clínica filtradas por las clínicas del usuario.
 */
async function getClinicRoutines(
  ctx: { db: { query: any; get: any } },
  userId: Id<"users">,
) {
  // Obtener clínicas del usuario
  const memberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  if (memberships.length === 0) return [];

  const clinicIds = new Set(memberships.map((m: any) => m.clinicId));

  // Obtener miembros de esas clínicas
  const allClinicMembers = [];
  for (const clinicId of clinicIds) {
    const members = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q: any) => q.eq("clinicId", clinicId))
      .collect();
    allClinicMembers.push(...members);
  }

  const clinicMemberIds = new Set(allClinicMembers.map((m: any) => m.userId as string));

  // Obtener rutinas de clínica solo de miembros de mis clínicas
  const allClinicRoutines = await ctx.db
    .query("routines")
    .withIndex("by_visibilidad", (q: any) => q.eq("visibilidad", "clinica"))
    .collect();

  return allClinicRoutines.filter((r: Doc<"routines">) =>
    clinicMemberIds.has(r.autorId as string),
  );
}

export const getById = query({
  args: { routineId: v.id("routines") },
  handler: async (ctx, args) => {
    const routine = await ctx.db.get(args.routineId);
    if (!routine) throw new Error("Rutina no encontrada");

    const exercises = await ctx.db
      .query("routineExercises")
      .withIndex("by_routineId_sort", (q) =>
        q.eq("routineId", args.routineId),
      )
      .collect();

    const enrichedExercises = await enrichRoutineExercises(ctx, exercises);

    // Cargar datos del autor
    const autor = await ctx.db.get(routine.autorId);

    return {
      ...routine,
      autor: autor
        ? {
            _id: autor._id,
            firstName: autor.firstName,
            lastName: autor.lastName,
            email: autor.email,
            avatar: autor.avatar,
          }
        : null,
      ejercicios: enrichedExercises,
    };
  },
});

