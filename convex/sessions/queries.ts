import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { resolvePacienteId } from "../_helpers/patientAccess";
import { batchGetMap } from "../_helpers/batchGet";

export const getById = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const listByPaciente = query({
  args: { pacienteId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_pacienteId", (q) => q.eq("pacienteId", args.pacienteId))
      .collect();
  },
});

/**
 * Devuelve las sesiones de un paciente en una fecha (típicamente 1 según BN1)
 * con sus `exerciseExecutions` expandidas (planExercise + exercise + plan).
 *
 * Esta es la vista "agrupada por sesión" que sustituye al uso legacy de
 * `records.queries.listByPacienteAndDateExpanded`.
 */
export const getByPacienteAndDateWithExecutions = query({
  args: {
    pacienteId: v.optional(v.string()),
    fecha: v.string(),
    soloCompletados: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetUserId = await resolvePacienteId(ctx, args.pacienteId, user._id);

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_pacienteId_fecha", (q) =>
        q.eq("pacienteId", targetUserId).eq("fecha", args.fecha),
      )
      .collect();

    const allExecutions = await Promise.all(
      sessions.map((s) =>
        ctx.db
          .query("exerciseExecutions")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", s._id))
          .collect(),
      ),
    );

    const flattened = allExecutions.flat();
    const filteredFlat = args.soloCompletados
      ? flattened.filter((e) => e.completado)
      : flattened;

    const planExerciseIds = filteredFlat.map((e) => e.planExerciseId);
    const planIds = filteredFlat.map((e) => e.planId);

    const planExercisesMap = await batchGetMap(ctx, planExerciseIds);
    const exerciseIds = Array.from(planExercisesMap.values()).map(
      (pe) => pe.exerciseId,
    );
    const [exercisesMap, plansMap] = await Promise.all([
      batchGetMap(ctx, exerciseIds),
      batchGetMap(ctx, planIds),
    ]);

    return sessions.map((s, i) => {
      const sessionExecutions = allExecutions[i] ?? [];
      const filtered = args.soloCompletados
        ? sessionExecutions.filter((e) => e.completado)
        : sessionExecutions;

      const expanded = filtered.map((e) => {
        const planExercise = planExercisesMap.get(e.planExerciseId) ?? null;
        const exercise = planExercise
          ? exercisesMap.get(planExercise.exerciseId) ?? null
          : null;
        const plan = plansMap.get(e.planId) ?? null;
        return {
          _id: e._id,
          fechaHora: e.fechaHora,
          completado: e.completado,
          repeticionesRealizadas: e.repeticionesRealizadas,
          duracionRealSeg: e.duracionRealSeg,
          dolorEscala: e.dolorEscala,
          esfuerzoEscala: e.esfuerzoEscala,
          notaPaciente: e.notaPaciente,
          planExercise: planExercise
            ? {
                _id: planExercise._id,
                sort: planExercise.sort,
                series: planExercise.series,
                repeticiones: planExercise.repeticiones,
                duracionSeg: planExercise.duracionSeg,
                instruccionesPaciente: planExercise.instruccionesPaciente,
                exercise: exercise
                  ? {
                      _id: exercise._id,
                      nombreEjercicio: exercise.nombreEjercicio,
                      portada: exercise.portada,
                    }
                  : null,
                plan: plan
                  ? {
                      _id: plan._id,
                      titulo: plan.titulo,
                    }
                  : null,
              }
            : null,
        };
      });

      return {
        _id: s._id,
        fecha: s.fecha,
        fechaInicio: s.fechaInicio,
        fechaFin: s.fechaFin,
        estado: s.estado,
        motivoCierre: s.motivoCierre,
        totalEsperados: s.totalEsperados,
        totalCompletados: s.totalCompletados,
        duracionTotalSeg: s.duracionTotalSeg,
        dolorMin: s.dolorMin,
        dolorMax: s.dolorMax,
        dolorPromedio: s.dolorPromedio,
        esfuerzoPromedio: s.esfuerzoPromedio,
        observacionesPaciente: s.observacionesPaciente,
        esSintetica: s.esSintetica,
        executions: expanded,
      };
    });
  },
});
