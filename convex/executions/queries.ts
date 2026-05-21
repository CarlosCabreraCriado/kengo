import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { resolveAndAssertPacienteId } from "../_helpers/patientAccess";
import { getCurrentMadridDate } from "../_helpers/datetime";

/**
 * Lista las ejecuciones de un paciente en una fecha (YYYY-MM-DD).
 * Sustituye al equivalente legacy `records.queries.listByPacienteAndDate`.
 */
export const listByPacienteAndDate = query({
  args: {
    pacienteId: v.optional(v.string()),
    fecha: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetUserId = await resolveAndAssertPacienteId(
      ctx,
      args.pacienteId,
      user._id,
    );

    return await ctx.db
      .query("exerciseExecutions")
      .withIndex("by_pacienteId_fecha", (q) =>
        q.eq("pacienteId", targetUserId).eq("fecha", args.fecha),
      )
      .collect();
  },
});

/**
 * Lista las ejecuciones de un paciente entre dos fechas (inclusivas).
 * Si no se pasa `hasta`, devuelve hasta hoy (Europe/Madrid).
 *
 * Para rangos largos (>30 días) usar `paginationOpts`.
 */
export const listByPacienteInRange = query({
  args: {
    pacienteId: v.optional(v.string()),
    desde: v.string(),
    hasta: v.optional(v.string()),
    soloCompletados: v.optional(v.boolean()),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetUserId = await resolveAndAssertPacienteId(
      ctx,
      args.pacienteId,
      user._id,
    );
    const hasta = args.hasta ?? getCurrentMadridDate();

    if (args.paginationOpts) {
      const result = await ctx.db
        .query("exerciseExecutions")
        .withIndex("by_pacienteId_fecha", (q) =>
          q
            .eq("pacienteId", targetUserId)
            .gte("fecha", args.desde)
            .lte("fecha", hasta),
        )
        .paginate(args.paginationOpts);
      if (args.soloCompletados) {
        return { ...result, page: result.page.filter((r) => r.completado) };
      }
      return result;
    }

    const records = await ctx.db
      .query("exerciseExecutions")
      .withIndex("by_pacienteId_fecha", (q) =>
        q
          .eq("pacienteId", targetUserId)
          .gte("fecha", args.desde)
          .lte("fecha", hasta),
      )
      .collect();

    return args.soloCompletados
      ? records.filter((r) => r.completado)
      : records;
  },
});

/**
 * Lista las ejecuciones de un paciente en una fecha con datos enriquecidos
 * (planExercise + exercise + plan). Sustituye al equivalente legacy
 * `records.queries.listByPacienteAndDateExpanded`.
 *
 * A diferencia del legacy, los nombres NO están denormalizados en
 * `exerciseExecutions`: se obtienen mediante lookups.
 */
export const listByPacienteAndDateExpanded = query({
  args: {
    pacienteId: v.optional(v.string()),
    fecha: v.string(),
    soloCompletados: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetUserId = await resolveAndAssertPacienteId(
      ctx,
      args.pacienteId,
      user._id,
    );

    const executions = await ctx.db
      .query("exerciseExecutions")
      .withIndex("by_pacienteId_fecha", (q) =>
        q.eq("pacienteId", targetUserId).eq("fecha", args.fecha),
      )
      .collect();

    const filtered = args.soloCompletados
      ? executions.filter((e) => e.completado)
      : executions;

    return await Promise.all(
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
          sessionId: e.sessionId,
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
      }),
    );
  },
});
