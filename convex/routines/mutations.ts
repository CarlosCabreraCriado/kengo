import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import {
  getAuthenticatedUser,
  requireActiveSubscription,
  requireAnyActiveSubscriptionForUser,
  checkClinicPermission,
} from "../_helpers/permissions";
import {
  assertCanAccessRoutine,
  getRoutineIfOwned,
} from "../_helpers/authorization";
import { diaSemana, tipoEjercicio } from "../_helpers/validators";
import { normalizarMetricaEjercicio } from "../_helpers/exercises";

const ejercicioRutinaValidator = v.object({
  exerciseId: v.id("exercises"),
  sort: v.number(),
  tipo: v.optional(tipoEjercicio),
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
    /**
     * Clínica destino. Obligatoria cuando `visibilidad === "clinica"` para
     * validar la suscripción contra esa clínica concreta (aislamiento
     * estricto, Bloque E del plan production-ready). Opcional cuando la
     * rutina es privada del autor.
     */
    clinicId: v.optional(v.id("clinics")),
    ejercicios: v.array(ejercicioRutinaValidator),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Aislamiento por clínica destino: una rutina de clínica solo se puede
    // crear contra una clínica activa donde el autor sea fisio/admin. Una
    // rutina privada del autor solo necesita "alguna clínica activa".
    if (args.visibilidad === "clinica") {
      if (!args.clinicId) {
        throw new ConvexError({
          code: "CLINIC_ID_REQUIRED",
          message:
            "Para crear una rutina de clínica debes indicar la clínica destino.",
        });
      }
      await checkClinicPermission(ctx, user._id, args.clinicId, [
        "fisio",
        "admin",
      ]);
      await requireActiveSubscription(ctx, args.clinicId);
    } else {
      await requireAnyActiveSubscriptionForUser(ctx, user._id);
    }

    const routineId = await ctx.db.insert("routines", {
      nombre: args.nombre,
      descripcion: args.descripcion,
      autorId: user._id,
      visibilidad: args.visibilidad,
      clinicId: args.visibilidad === "clinica" ? args.clinicId : undefined,
    });

    for (const ejercicio of args.ejercicios) {
      const { repeticiones, duracionSeg } =
        normalizarMetricaEjercicio(ejercicio);
      await ctx.db.insert("routineExercises", {
        routineId,
        exerciseId: ejercicio.exerciseId,
        sort: ejercicio.sort,
        tipo: ejercicio.tipo,
        series: ejercicio.series,
        repeticiones,
        duracionSeg,
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
    /**
     * Clínica destino cuando la rutina queda con `visibilidad === "clinica"`.
     * Necesaria al pasar de privado a clínica (o para reasignar de clínica);
     * si se omite se conserva la clínica actual de la rutina.
     */
    clinicId: v.optional(v.id("clinics")),
    ejercicios: v.optional(v.array(ejercicioRutinaValidator)),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const routine = await getRoutineIfOwned(ctx, args.routineId);

    // Patch metadata
    const patch: Record<string, unknown> = {};
    if (args.nombre !== undefined) patch["nombre"] = args.nombre;
    if (args.descripcion !== undefined) patch["descripcion"] = args.descripcion;
    if (args.visibilidad !== undefined) patch["visibilidad"] = args.visibilidad;

    // Aislamiento: la visibilidad resultante determina la clínica destino.
    // Una rutina "clinica" siempre debe quedar con clinicId (una sin él no
    // sería visible para nadie más que el autor); una privada, sin él.
    const visibilidadFinal = args.visibilidad ?? routine.visibilidad;
    if (visibilidadFinal === "clinica") {
      const clinicId = args.clinicId ?? routine.clinicId;
      if (!clinicId) {
        throw new ConvexError({
          code: "CLINIC_ID_REQUIRED",
          message:
            "Para hacer visible una rutina a la clínica debes indicar la clínica destino.",
        });
      }
      await checkClinicPermission(ctx, user._id, clinicId, ["fisio", "admin"]);
      await requireActiveSubscription(ctx, clinicId);
      if (routine.clinicId !== clinicId) patch["clinicId"] = clinicId;
    } else {
      await requireAnyActiveSubscriptionForUser(ctx, user._id);
      if (routine.clinicId !== undefined) patch["clinicId"] = undefined;
    }

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
        const { repeticiones, duracionSeg } =
          normalizarMetricaEjercicio(ejercicio);
        await ctx.db.insert("routineExercises", {
          routineId: args.routineId,
          exerciseId: ejercicio.exerciseId,
          sort: ejercicio.sort,
          tipo: ejercicio.tipo,
          series: ejercicio.series,
          repeticiones,
          duracionSeg,
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
    // Solo se puede duplicar una rutina a la que se tiene acceso (autor o
    // miembro de su clínica); la copia se crea como "privado" del usuario,
    // así que basta con que tenga alguna clínica activa.
    const routine = await assertCanAccessRoutine(ctx, user._id, args.routineId);
    await requireAnyActiveSubscriptionForUser(ctx, user._id);

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
        tipo: ex.tipo,
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
