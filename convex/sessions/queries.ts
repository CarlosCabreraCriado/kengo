import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { resolvePacienteId } from "../_helpers/patientAccess";

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

    return await Promise.all(
      sessions.map(async (s) => {
        const executions = await ctx.db
          .query("exerciseExecutions")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", s._id))
          .collect();

        const filtered = args.soloCompletados
          ? executions.filter((e) => e.completado)
          : executions;

        const expanded = await Promise.all(
          filtered.map(async (e) => {
            const planExercise = await ctx.db.get(e.planExerciseId);
            const [exercise, plan] = await Promise.all([
              planExercise
                ? ctx.db.get(planExercise.exerciseId)
                : Promise.resolve(null),
              ctx.db.get(e.planId),
            ]);
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
                    legacyId: planExercise.legacyId,
                    sort: planExercise.sort,
                    series: planExercise.series,
                    repeticiones: planExercise.repeticiones,
                    duracionSeg: planExercise.duracionSeg,
                    instruccionesPaciente: planExercise.instruccionesPaciente,
                    exercise: exercise
                      ? {
                          _id: exercise._id,
                          legacyId: exercise.legacyId,
                          nombreEjercicio:
                            planExercise.ejercicioNombre ??
                            exercise.nombreEjercicio,
                          portada: exercise.portada,
                        }
                      : null,
                    plan: plan
                      ? {
                          _id: plan._id,
                          legacyId: plan.legacyId,
                          titulo: plan.titulo,
                        }
                      : null,
                  }
                : null,
            };
          }),
        );

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
      }),
    );
  },
});
