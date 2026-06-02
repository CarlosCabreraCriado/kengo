import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { resolveAndAssertPacienteAndClinic } from "../_helpers/patientAccess";
import { assertCanAccessSession } from "../_helpers/authorization";
import { batchGetMap } from "../_helpers/batchGet";

export const getById = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    return await assertCanAccessSession(ctx, user._id, args.sessionId);
  },
});

export const listByPaciente = query({
  args: {
    pacienteId: v.id("users"),
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const { pacienteId: targetId, clinicId: targetClinicId } =
      await resolveAndAssertPacienteAndClinic(
        ctx,
        args.pacienteId,
        args.clinicId,
        user._id,
      );

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_pacienteId", (q) => q.eq("pacienteId", targetId))
      .collect();

    return targetClinicId
      ? sessions.filter((s) => s.clinicId === targetClinicId)
      : sessions;
  },
});

/**
 * Devuelve las últimas N sesiones de un paciente (orden descendente por
 * fecha) con el título del primer plan asociado denormalizado. Pensado para
 * el historial reciente de la página de estadísticas.
 */
export const listRecentByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    clinicId: v.optional(v.id("clinics")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const { pacienteId: targetUserId, clinicId: targetClinicId } =
      await resolveAndAssertPacienteAndClinic(
        ctx,
        args.pacienteId,
        args.clinicId,
        user._id,
      );
    const limit = args.limit ?? 5;

    // Cuando filtramos por clínica, sobre-leemos para tener margen tras el
    // filtro en memoria (el índice no incluye `clinicId`). Para pacientes con
    // planes mayoritariamente en una sola clínica el coste es despreciable.
    const fetchSize = targetClinicId ? Math.max(limit * 5, 25) : limit;
    const rawSessions = await ctx.db
      .query("sessions")
      .withIndex("by_pacienteId_fecha", (q) =>
        q.eq("pacienteId", targetUserId),
      )
      .order("desc")
      .take(fetchSize);
    const sessions = targetClinicId
      ? rawSessions.filter((s) => s.clinicId === targetClinicId).slice(0, limit)
      : rawSessions;

    const planIds = sessions
      .map((s) => s.planIds?.[0])
      .filter((id): id is NonNullable<typeof id> => Boolean(id));
    const plansMap = await batchGetMap(ctx, planIds);

    return sessions.map((s) => {
      const firstPlanId = s.planIds?.[0];
      const plan = firstPlanId ? plansMap.get(firstPlanId) ?? null : null;
      return {
        sessionId: s._id,
        fecha: s.fecha,
        fechaInicio: s.fechaInicio,
        fechaFin: s.fechaFin,
        estado: s.estado,
        totalEsperados: s.totalEsperados,
        totalCompletados: s.totalCompletados,
        duracionTotalSeg: s.duracionTotalSeg,
        dolorPromedio: s.dolorPromedio,
        esSintetica: s.esSintetica,
        planTitulo: plan?.titulo ?? null,
      };
    });
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
    clinicId: v.optional(v.id("clinics")),
    fecha: v.string(),
    soloCompletados: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const { pacienteId: targetUserId, clinicId: targetClinicId } =
      await resolveAndAssertPacienteAndClinic(
        ctx,
        args.pacienteId,
        args.clinicId,
        user._id,
      );

    const rawSessions = await ctx.db
      .query("sessions")
      .withIndex("by_pacienteId_fecha", (q) =>
        q.eq("pacienteId", targetUserId).eq("fecha", args.fecha),
      )
      .collect();
    const sessions = targetClinicId
      ? rawSessions.filter((s) => s.clinicId === targetClinicId)
      : rawSessions;

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
