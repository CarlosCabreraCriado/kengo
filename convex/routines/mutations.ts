import { v } from "convex/values";
import { mutation } from "../_generated/server";
import {
  getAuthenticatedUser,
  requireAnyActiveSubscriptionForUser,
} from "../_helpers/permissions";
import { getRoutineIfOwned } from "../_helpers/authorization";
import { diaSemana } from "../_helpers/validators";

const ejercicioRutinaValidator = v.object({
  exerciseId: v.id("exercises"),
  sort: v.number(),
  series: v.optional(v.number()),
  repeticiones: v.optional(v.number()),
  duracionSeg: v.optional(v.number()),
  descansoSeg: v.optional(v.number()),
  diasSemana: v.optional(v.array(diaSemana)),
  instruccionesPaciente: v.optional(v.string()),
  notasFisio: v.optional(v.string()),
});

export const create = mutation({
  args: {
    nombre: v.string(),
    descripcion: v.optional(v.string()),
    visibilidad: v.union(v.literal("privado"), v.literal("clinica")),
    ejercicios: v.array(ejercicioRutinaValidator),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await requireAnyActiveSubscriptionForUser(ctx, user._id);

    const routineId = await ctx.db.insert("routines", {
      nombre: args.nombre,
      descripcion: args.descripcion,
      autorId: user._id,
      visibilidad: args.visibilidad,
    });

    for (const ejercicio of args.ejercicios) {
      await ctx.db.insert("routineExercises", {
        routineId,
        exerciseId: ejercicio.exerciseId,
        sort: ejercicio.sort,
        series: ejercicio.series,
        repeticiones: ejercicio.repeticiones,
        duracionSeg: ejercicio.duracionSeg,
        descansoSeg: ejercicio.descansoSeg,
        diasSemana: ejercicio.diasSemana,
        instruccionesPaciente: ejercicio.instruccionesPaciente,
        notasFisio: ejercicio.notasFisio,
      });
    }

    return routineId;
  },
});

export const remove = mutation({
  args: { routineId: v.id("routines") },
  handler: async (ctx, args) => {
    await getRoutineIfOwned(ctx, args.routineId);

    const exercises = await ctx.db
      .query("routineExercises")
      .withIndex("by_routineId", (q) => q.eq("routineId", args.routineId))
      .collect();

    for (const exercise of exercises) {
      await ctx.db.delete(exercise._id);
    }

    await ctx.db.delete(args.routineId);
  },
});

export const update = mutation({
  args: {
    routineId: v.id("routines"),
    nombre: v.optional(v.string()),
    descripcion: v.optional(v.string()),
    visibilidad: v.optional(
      v.union(v.literal("privado"), v.literal("clinica")),
    ),
    ejercicios: v.optional(v.array(ejercicioRutinaValidator)),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await requireAnyActiveSubscriptionForUser(ctx, user._id);
    await getRoutineIfOwned(ctx, args.routineId);

    // Patch metadata
    const patch: Record<string, unknown> = {};
    if (args.nombre !== undefined) patch["nombre"] = args.nombre;
    if (args.descripcion !== undefined) patch["descripcion"] = args.descripcion;
    if (args.visibilidad !== undefined) patch["visibilidad"] = args.visibilidad;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.routineId, patch);
    }

    // Si se proporcionan ejercicios, reemplazar todos atómicamente
    if (args.ejercicios !== undefined) {
      const existing = await ctx.db
        .query("routineExercises")
        .withIndex("by_routineId", (q) => q.eq("routineId", args.routineId))
        .collect();

      for (const ex of existing) {
        await ctx.db.delete(ex._id);
      }

      for (const ejercicio of args.ejercicios) {
        await ctx.db.insert("routineExercises", {
          routineId: args.routineId,
          exerciseId: ejercicio.exerciseId,
          sort: ejercicio.sort,
          series: ejercicio.series,
          repeticiones: ejercicio.repeticiones,
          duracionSeg: ejercicio.duracionSeg,
          descansoSeg: ejercicio.descansoSeg,
          diasSemana: ejercicio.diasSemana,
          instruccionesPaciente: ejercicio.instruccionesPaciente,
          notasFisio: ejercicio.notasFisio,
        });
      }
    }

    return args.routineId;
  },
});

export const duplicate = mutation({
  args: {
    routineId: v.id("routines"),
    nuevoNombre: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await requireAnyActiveSubscriptionForUser(ctx, user._id);
    const routine = await ctx.db.get(args.routineId);
    if (!routine) throw new Error("Rutina no encontrada");

    const exercises = await ctx.db
      .query("routineExercises")
      .withIndex("by_routineId", (q) => q.eq("routineId", args.routineId))
      .collect();

    const newRoutineId = await ctx.db.insert("routines", {
      nombre: args.nuevoNombre,
      descripcion: routine.descripcion,
      autorId: user._id,
      visibilidad: "privado",
    });

    for (const ex of exercises) {
      await ctx.db.insert("routineExercises", {
        routineId: newRoutineId,
        exerciseId: ex.exerciseId,
        sort: ex.sort,
        series: ex.series,
        repeticiones: ex.repeticiones,
        duracionSeg: ex.duracionSeg,
        descansoSeg: ex.descansoSeg,
        diasSemana: ex.diasSemana,
        instruccionesPaciente: ex.instruccionesPaciente,
        notasFisio: ex.notasFisio,
      });
    }

    return newRoutineId;
  },
});
