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
} from "../_helpers/expectedExercises";
import { getDiaSemana } from "../_helpers/datetime";
import { computeEstadoDia } from "../_helpers/rollupComputation";
import { computeDayCounts, ExpectedSlot } from "../_helpers/sessionCounting";
import { enrichExecutionsForCount } from "../_helpers/sessionCountingDb";
import { resolveCanonicalPlanId } from "../_helpers/planVersioning";

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
        totalExtras: s.totalExtras,
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

    // Conjunto esperado del día para marcar cada execution como programada o
    // extra (informativo para la UI; los totales ya vienen del doc de sesión).
    const expectedHoy = await getExpectedExercisesForPatientOnDate(
      ctx,
      targetUserId,
      args.fecha,
      getDiaSemana(args.fecha),
      targetClinicId ?? undefined,
    );
    const expectedPlanExerciseIds = new Set(
      expectedHoy.map((e) => e.planExerciseId),
    );

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
          programadoHoy: expectedPlanExerciseIds.has(e.planExerciseId),
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
        totalExtras: s.totalExtras,
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
 * marcados como hechos o pendientes, más el estado del día (`estadoDia`), el
 * total de `extras` (trabajo completado no programado ese día) y su detalle.
 *
 * Computa en vivo con el MISMO helper de conteo por identidad que el cierre
 * de sesión y el rollup (`computeDayCounts`), por lo que los contadores
 * cuadran con el timeline (`dailyPatientRollup`) y con las filas del desglose
 * por construcción: `totalCompletados` = esperados matcheados (dedup por
 * planExerciseId, con fallback cross-versión por exerciseId de catálogo).
 *
 * `completados` por plan se atribuye por PROPIEDAD del `planExercise` esperado
 * (qué plan vigente lo prescribe); los extras se atribuyen al plan canónico de
 * la ejecución.
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

    // 2. Esperados por plan (idéntico al rollup), enriquecidos con el plan
    //    canónico para el matching cross-versión.
    const canonicalCache = new Map<Id<"plans">, Id<"plans">>();
    const expectedItems = await getExpectedExercisesForPatientOnDate(
      ctx,
      targetUserId,
      fecha,
      diaSemana,
      clinicId,
    );
    const expected: ExpectedSlot[] = [];
    for (const it of expectedItems) {
      expected.push({
        ...it,
        canonicalPlanId: await resolveCanonicalPlanId(
          ctx,
          it.planId,
          canonicalCache,
        ),
      });
    }

    // 3. planExercises de cada plan vigente (una sola lectura por plan).
    const planExercisesByPlan = await Promise.all(
      planes.map((p) =>
        ctx.db
          .query("planExercises")
          .withIndex("by_planId_sort", (q) => q.eq("planId", p._id))
          .collect(),
      ),
    );

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

    // 5. Conteo canónico por IDENTIDAD (mismo helper que sesión y rollup):
    //    `totalCompletados` = esperados matcheados (dedup, con fallback
    //    cross-versión por exerciseId) — el número cuadra con las filas del
    //    desglose por construcción. El trabajo no programado hoy va a `extras`.
    const { enriched } = await enrichExecutionsForCount(
      ctx,
      executions,
      canonicalCache,
    );
    const counts = computeDayCounts(expected, enriched);
    const totalEsperados = counts.totalEsperados;
    const totalCompletados = counts.totalCompletados;

    let dolorSum = 0;
    let dolorCount = 0;
    for (const ex of counts.dedupExecutions) {
      if (ex.dolorEscala !== undefined) {
        dolorSum += ex.dolorEscala;
        dolorCount += 1;
      }
    }

    // 6. Detalle de ejercicios por plan: los programados ese día, marcados
    //    como hechos si un esperado fue matcheado (aunque la ejecución apunte
    //    al planExercise de una versión anterior del plan).
    const extrasPlanExerciseMap = await batchGetMap(
      ctx,
      counts.extras.map((e) => e.planExerciseId),
    );
    const allExerciseIds = [
      ...planExercisesByPlan.flat().map((pe) => pe.exerciseId),
      ...counts.extras
        .map((e) => e.exerciseId)
        .filter((id): id is Id<"exercises"> => id !== undefined),
    ];
    const exMap = await batchGetMap<"exercises">(ctx, allExerciseIds);

    const aplicaDia = (pe: Doc<"planExercises">): boolean =>
      !pe.diasSemana ||
      pe.diasSemana.length === 0 ||
      pe.diasSemana.includes(diaSemana);

    const planesDetalle = planes
      .map((plan, i) => {
        const ejercicios = planExercisesByPlan[i]
          .filter((pe) => aplicaDia(pe))
          .map((pe) => {
            const exec = counts.matchedByExpected.get(pe._id) ?? null;
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
              programadoHoy: true,
              completado: exec !== null,
              repeticionesRealizadas: exec?.repeticionesRealizadas,
              duracionRealSeg: exec?.duracionRealSeg,
              dolorEscala: exec?.dolorEscala,
              esfuerzoEscala: exec?.esfuerzoEscala,
              notaPaciente: exec?.notaPaciente,
              fechaHora: exec?.fechaHora,
            };
          })
          .sort((a, b) => a.sort - b.sort);

        const c = counts.porPlan.get(plan._id);
        return {
          planId: plan._id,
          titulo: plan.titulo,
          esperados: c?.esperados ?? 0,
          completados: c?.completados ?? 0,
          extras: c?.extras ?? 0,
          ejercicios,
        };
      })
      // Ocultar planes vigentes sin nada que mostrar ese día (0 programados y
      // 0 extras). Los extras propios se muestran en la sección `extras`.
      .filter((p) => p.ejercicios.length > 0 || p.extras > 0);

    // 7. Sección de extras: trabajo completado no programado hoy, con nombre
    //    del ejercicio y plan de origen (canónico) para que el fisio lo vea.
    const extrasPlanIds = counts.extras.map(
      (e) => e.canonicalPlanId ?? e.planId,
    );
    const extrasPlansMap = await batchGetMap(ctx, extrasPlanIds);
    const extrasDetalle = counts.extras.map((e) => {
      const pe = extrasPlanExerciseMap.get(e.planExerciseId) ?? null;
      const exercise = e.exerciseId ? exMap.get(e.exerciseId) ?? null : null;
      const plan = extrasPlansMap.get(e.canonicalPlanId ?? e.planId) ?? null;
      return {
        executionId: e.executionId,
        planExerciseId: e.planExerciseId,
        nombre: exercise?.nombreEjercicio ?? "",
        portada: exercise?.portada ?? null,
        series: pe?.series,
        repeticiones: pe?.repeticiones,
        duracionSeg: pe?.duracionSeg,
        planId: plan?._id ?? null,
        planTitulo: plan?.titulo ?? null,
        fechaHora: e.fechaHora,
        repeticionesRealizadas: e.repeticionesRealizadas,
        duracionRealSeg: e.duracionRealSeg,
        dolorEscala: e.dolorEscala,
        esfuerzoEscala: e.esfuerzoEscala,
        notaPaciente: e.notaPaciente,
      };
    });

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
      totalExtras: counts.totalExtras,
      dolorPromedio,
      planes: planesDetalle,
      extras: extrasDetalle,
    };
  },
});
