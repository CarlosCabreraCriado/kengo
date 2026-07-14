import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import {
  assertCanAccessClinic,
  assertCanAccessRoutine,
} from "../_helpers/authorization";

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
    /**
     * Clínica activa del usuario. Las rutinas de clínica se acotan a ella
     * (aislamiento estricto multiclínica). Sin `clinicId` solo se devuelven
     * las rutinas privadas del propio usuario.
     */
    clinicId: v.optional(v.id("clinics")),
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

    const own = await ctx.db
      .query("routines")
      .withIndex("by_autorId", (q) => q.eq("autorId", user._id))
      .collect();
    const ownPrivadas = own.filter((r) => r.visibilidad === "privado");

    // Rutinas de la clínica activa, solo si el usuario es miembro. Toda
    // rutina devuelta aquí pasa assertCanAccessRoutine en getById: mismo
    // criterio (membresía en routine.clinicId), sin sorpresas al abrirla.
    let clinicRoutines: Doc<"routines">[] = [];
    const clinicId = args.clinicId;
    if (clinicId) {
      try {
        await assertCanAccessClinic(ctx, user._id, clinicId);
        const byClinic = await ctx.db
          .query("routines")
          .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
          .collect();
        clinicRoutines = byClinic.filter((r) => r.visibilidad === "clinica");
      } catch {
        // No miembro de la clínica indicada → aislamiento: sin rutinas de clínica.
        clinicRoutines = [];
      }
    }

    let routines: Doc<"routines">[];
    if (args.visibilidad === "privado") {
      routines = ownPrivadas;
    } else if (args.visibilidad === "clinica") {
      routines = clinicRoutines;
    } else {
      // Todas: privadas propias + las de la clínica activa (disjuntas por visibilidad).
      routines = [...ownPrivadas, ...clinicRoutines];
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

export const getById = query({
  args: { routineId: v.id("routines") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    let routine: Doc<"routines">;
    try {
      routine = await assertCanAccessRoutine(ctx, user._id, args.routineId);
    } catch {
      // ConvexError con code: los Error planos se redactan en producción y
      // el cliente no podría distinguir "sin acceso" de un fallo genérico.
      throw new ConvexError({
        code: "NO_ACCESO",
        message: "No tienes acceso a esta rutina",
      });
    }

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
