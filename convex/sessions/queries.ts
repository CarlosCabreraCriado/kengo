import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { resolveAndAssertPacienteAndClinic } from "../_helpers/patientAccess";
import { assertCanAccessSession } from "../_helpers/authorization";
import { batchGetMap } from "../_helpers/batchGet";
import {
  getActivePlansForPatientOnDate,
  getExpectedExercisesForPatientOnDate,
  sumExpectedByPlan,
} from "../_helpers/expectedExercises";
import { getDiaSemana } from "../_helpers/datetime";
import { computeEstadoDia } from "../_helpers/rollupComputation";

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

/**
 * Detalle del día de un paciente con el desglose POR PLAN: para cada plan
 * vigente ese día devuelve `esperados`/`completados` y la lista de ejercicios
 * marcados como hechos o pendientes, más el estado del día (`estadoDia`).
 *
 * Computa en vivo con los MISMOS helpers que el rollup
 * (`getActivePlansForPatientOnDate` + `getExpectedExercisesForPatientOnDate` +
 * `computeEstadoDia`), por lo que los contadores cuadran con el timeline
 * (`dailyPatientRollup`) por construcción — sin el sesgo de
 * `getByPacienteAndDateWithExecutions`, que solo conoce lo ejecutado y oculta
 * planes/ejercicios pendientes.
 *
 * `completados` por plan se atribuye por PROPIEDAD del `planExercise` (qué plan
 * lo contiene), no por `resolveCanonicalPlanId`: la resolución canónica salta
 * siempre a la última versión de la cadena y, en días previos a un versionado,
 * atribuiría las ejecuciones del plan viejo al sucesor (mostrando 0). La
 * propiedad del `planExercise` es correcta por fecha porque
 * `getActivePlansForPatientOnDate` (con `dropSupersededVersions`) ya devuelve la
 * versión vigente de cada día.
 */
export const getDayDetailByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    clinicId: v.optional(v.id("clinics")),
    fecha: v.string(),
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

    const fecha = args.fecha;
    const diaSemana = getDiaSemana(fecha);
    const clinicId = targetClinicId ?? undefined;

    // 1. Planes vigentes ese día (sin versiones supersedidas).
    const planes = await getActivePlansForPatientOnDate(
      ctx,
      targetUserId,
      fecha,
      clinicId,
    );

    // 2. Esperados por plan (idéntico al rollup).
    const expected = await getExpectedExercisesForPatientOnDate(
      ctx,
      targetUserId,
      fecha,
      diaSemana,
      clinicId,
    );
    const { totalEsperados, porPlan: esperadosPorPlan } =
      sumExpectedByPlan(expected);

    // 3. planExercises de cada plan vigente (una sola lectura por plan) +
    //    mapa de propiedad planExerciseId → plan, para atribuir completados.
    const planExercisesByPlan = await Promise.all(
      planes.map((p) =>
        ctx.db
          .query("planExercises")
          .withIndex("by_planId_sort", (q) => q.eq("planId", p._id))
          .collect(),
      ),
    );
    const ownerByPlanExercise = new Map<Id<"planExercises">, Id<"plans">>();
    planes.forEach((p, i) => {
      for (const pe of planExercisesByPlan[i]) {
        ownerByPlanExercise.set(pe._id, p._id);
      }
    });

    // 4. Ejecuciones del día filtradas a la clínica.
    const allExecs = await ctx.db
      .query("exerciseExecutions")
      .withIndex("by_pacienteId_fecha", (q) =>
        q.eq("pacienteId", targetUserId).eq("fecha", fecha),
      )
      .collect();
    const executions = targetClinicId
      ? allExecs.filter((e) => e.clinicId === targetClinicId)
      : allExecs;

    // 5. Completados por plan + última ejecución completada por planExercise
    //    (para el detalle). `totalCompletados` cuenta todas las completadas del
    //    día (igual que el rollup), para que `estadoDia` cuadre con el timeline.
    const completadosPorPlan = new Map<Id<"plans">, number>();
    const execByPlanExercise = new Map<
      Id<"planExercises">,
      Doc<"exerciseExecutions">
    >();
    let totalCompletados = 0;
    let dolorSum = 0;
    let dolorCount = 0;
    for (const ex of executions) {
      if (ex.completado) {
        totalCompletados += 1;
        const owner = ownerByPlanExercise.get(ex.planExerciseId);
        if (owner) {
          completadosPorPlan.set(owner, (completadosPorPlan.get(owner) ?? 0) + 1);
        }
        const prev = execByPlanExercise.get(ex.planExerciseId);
        if (!prev || ex.fechaHora > prev.fechaHora) {
          execByPlanExercise.set(ex.planExerciseId, ex);
        }
      }
      if (ex.dolorEscala !== undefined) {
        dolorSum += ex.dolorEscala;
        dolorCount += 1;
      }
    }

    // 6. Detalle de ejercicios por plan: los programados ese día + los que
    //    tengan ejecución completada (aunque sea fuera de calendario), para no
    //    ocultar trabajo hecho.
    const allExerciseIds = planExercisesByPlan
      .flat()
      .map((pe) => pe.exerciseId)
      .filter(Boolean);
    const exMap = await batchGetMap<"exercises">(ctx, allExerciseIds);

    const aplicaDia = (pe: Doc<"planExercises">): boolean =>
      !pe.diasSemana ||
      pe.diasSemana.length === 0 ||
      pe.diasSemana.includes(diaSemana);

    const planesDetalle = planes
      .map((plan, i) => {
        const ejercicios = planExercisesByPlan[i]
          .filter((pe) => aplicaDia(pe) || execByPlanExercise.has(pe._id))
          .map((pe) => {
            const exec = execByPlanExercise.get(pe._id) ?? null;
            const exercise = pe.exerciseId
              ? exMap.get(pe.exerciseId) ?? null
              : null;
            return {
              planExerciseId: pe._id,
              sort: pe.sort,
              nombre: exercise?.nombreEjercicio ?? "",
              portada: exercise?.portada ?? null,
              series: pe.series,
              repeticiones: pe.repeticiones,
              duracionSeg: pe.duracionSeg,
              instruccionesPaciente: pe.instruccionesPaciente,
              programadoHoy: aplicaDia(pe),
              completado: exec ? exec.completado : false,
              repeticionesRealizadas: exec?.repeticionesRealizadas,
              duracionRealSeg: exec?.duracionRealSeg,
              dolorEscala: exec?.dolorEscala,
              esfuerzoEscala: exec?.esfuerzoEscala,
              notaPaciente: exec?.notaPaciente,
              fechaHora: exec?.fechaHora,
            };
          })
          .sort((a, b) => a.sort - b.sort);

        return {
          planId: plan._id,
          titulo: plan.titulo,
          esperados: esperadosPorPlan.get(plan._id) ?? 0,
          completados: completadosPorPlan.get(plan._id) ?? 0,
          ejercicios,
        };
      })
      // Ocultar planes vigentes sin nada que mostrar ese día (0 programados y 0
      // hechos), igual que el timeline (`buildSesionesAgrupadas` filtra
      // `esperados > 0`). Se conservan los que tengan trabajo hecho.
      .filter((p) => p.ejercicios.length > 0);

    const estadoDia = computeEstadoDia(
      totalEsperados,
      totalCompletados,
      planes.length > 0,
    );
    const dolorPromedio =
      dolorCount > 0 ? Math.round((dolorSum / dolorCount) * 10) / 10 : undefined;

    return {
      fecha,
      estadoDia,
      totalEsperados,
      totalCompletados,
      dolorPromedio,
      planes: planesDetalle,
    };
  },
});
