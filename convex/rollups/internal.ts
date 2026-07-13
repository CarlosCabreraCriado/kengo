import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { getActivePlansForPatientOnDate } from "../_helpers/expectedExercises";
import { computeDayCountsForPatient } from "../_helpers/sessionCountingDb";
import {
  anioMes,
  anioSemanaISO,
  endOfISOWeek,
  endOfMonth,
  getMadridDateOffset,
  rangeOfDates,
  startOfISOWeek,
  startOfMonth,
} from "../_helpers/datetime";
import {
  computeEstadoDia,
  computeRachaMaxima,
  EstadoDia,
} from "../_helpers/rollupComputation";
import { patientsWithActivePlanByClinic } from "../aggregates/patientsWithActivePlanByClinic";

/**
 * Recompute determinista del rollup diario de un (paciente, fecha) desde
 * `sessions` + `exerciseExecutions`, y propagación marcando `stale=true`
 * los rollups semanal y mensual correspondientes.
 *
 * Llamada después de cada cierre de sesión y desde el cron diario.
 */
export const recomputeDayAndPropagate = internalMutation({
  args: {
    pacienteId: v.id("users"),
    fecha: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    await recomputeDayAndPropagateImpl(ctx, args.pacienteId, args.fecha);
  },
});

export async function recomputeDayAndPropagateImpl(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  fecha: string,
): Promise<void> {
  // 1. Sesiones del día (todas las clínicas).
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).eq("fecha", fecha),
    )
    .collect();

  // 2. Ejecuciones del día (todas las clínicas).
  const executions = await ctx.db
    .query("exerciseExecutions")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).eq("fecha", fecha),
    )
    .collect();

  // 3. Planes vigentes del paciente para esa fecha.
  const planes = await getActivePlansForPatientOnDate(ctx, pacienteId, fecha);

  // 4. Agrupar planes por clínica. Solo consideramos planes con `clinicId`
  //    asignado (los legados sin clinicId quedan fuera del rollup
  //    particionado — su recompute lo aborda el backfill 3b).
  const planesByClinic = new Map<Id<"clinics">, typeof planes>();
  for (const p of planes) {
    if (!p.clinicId) continue;
    const arr = planesByClinic.get(p.clinicId) ?? [];
    arr.push(p);
    planesByClinic.set(p.clinicId, arr);
  }

  // 5. Conjunto de clínicas con actividad ese día: la unión de las clínicas
  //    con sesión, ejecución o plan vigente.
  const clinicIdsConActividad = new Set<Id<"clinics">>();
  for (const s of sessions) clinicIdsConActividad.add(s.clinicId);
  for (const e of executions) clinicIdsConActividad.add(e.clinicId);
  for (const cId of planesByClinic.keys()) clinicIdsConActividad.add(cId);

  // 6. Para cada clínica con actividad, computar y upsertar su daily.
  for (const clinicId of clinicIdsConActividad) {
    await upsertDailyForClinic(ctx, {
      pacienteId,
      clinicId,
      fecha,
      sessions: sessions.filter((s) => s.clinicId === clinicId),
      executions: executions.filter((e) => e.clinicId === clinicId),
      planes: planesByClinic.get(clinicId) ?? [],
    });
  }

  // 7. Borrar dailies particionados que ya no tienen actividad (p.ej. tras
  //    cancelar el plan que justificaba el daily de esa clínica).
  const existingDailies = await ctx.db
    .query("dailyPatientRollup")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).eq("fecha", fecha),
    )
    .collect();
  for (const d of existingDailies) {
    if (!d.clinicId) continue; // legado: lo gestiona el backfill 3b
    if (!clinicIdsConActividad.has(d.clinicId)) {
      await ctx.db.delete(d._id);
    }
  }

  // 8. Marcar stale weekly + monthly por clínica afectada.
  const anioSemana = anioSemanaISO(fecha);
  const anioMesStr = anioMes(fecha);
  for (const clinicId of clinicIdsConActividad) {
    await markWeeklyStale(ctx, pacienteId, clinicId, anioSemana);
    await markMonthlyStale(ctx, pacienteId, clinicId, anioMesStr);
  }
}

interface UpsertDailyInput {
  pacienteId: Id<"users">;
  clinicId: Id<"clinics">;
  fecha: string;
  sessions: Doc<"sessions">[];
  executions: Doc<"exerciseExecutions">[];
  planes: Doc<"plans">[];
}

async function upsertDailyForClinic(
  ctx: MutationCtx,
  input: UpsertDailyInput,
): Promise<void> {
  const { pacienteId, clinicId, fecha, sessions, executions, planes } = input;

  // Conteo canónico por IDENTIDAD (mismo helper que el cierre de sesión y
  // el detalle del fisio): esperados restringidos a los planes de esta
  // clínica, completados = esperados matcheados (dedup por planExerciseId,
  // con fallback cross-versión por exerciseId), extras aparte.
  const { counts } = await computeDayCountsForPatient(ctx, {
    pacienteId,
    fecha,
    clinicId,
    executions,
  });
  const totalEsperados = counts.totalEsperados;
  const totalCompletados = counts.totalCompletados;

  // Dolor/esfuerzo agregados sobre las ejecuciones dedup, atribuyendo el
  // dolor por plan al id canónico de cada ejecución (las executions guardan
  // el `planId` inmutable con el que se crearon; tras un versionado los
  // esperados viven en el sucesor — ver Bug 1 en
  // AUDITORIA_AGGREGATES_CONVEX.md).
  const doloresPorPlan = new Map<Id<"plans">, number[]>();
  let dolorSum = 0;
  let dolorCount = 0;
  let esfuerzoSum = 0;
  let esfuerzoCount = 0;
  for (const ex of counts.dedupExecutions) {
    if (ex.dolorEscala !== undefined) {
      dolorSum += ex.dolorEscala;
      dolorCount += 1;
      const planKey = ex.canonicalPlanId ?? ex.planId;
      const arr = doloresPorPlan.get(planKey) ?? [];
      arr.push(ex.dolorEscala);
      doloresPorPlan.set(planKey, arr);
    }
    if (ex.esfuerzoEscala !== undefined) {
      esfuerzoSum += ex.esfuerzoEscala;
      esfuerzoCount += 1;
    }
  }

  // Una entrada por plan vigente de la clínica + entradas adicionales de
  // `porPlan` (extras atribuidos a un plan no vigente hoy) para que el
  // trabajo hecho nunca desaparezca del desglose.
  const planIdsAgg = new Set<Id<"plans">>(planes.map((p) => p._id));
  for (const planId of counts.porPlan.keys()) planIdsAgg.add(planId);
  const planAggregates = Array.from(planIdsAgg).map((planId) => {
    const c = counts.porPlan.get(planId);
    const dolores = doloresPorPlan.get(planId);
    const dolorMedio =
      dolores && dolores.length > 0
        ? round2(dolores.reduce((a, b) => a + b, 0) / dolores.length)
        : undefined;
    return {
      planId,
      esperados: c?.esperados ?? 0,
      completados: c?.completados ?? 0,
      extras: c?.extras ?? 0,
      dolorMedio,
    };
  });

  const estadoDia = computeEstadoDia(
    totalEsperados,
    totalCompletados,
    planes.length > 0,
  );
  const dolorPromedio =
    dolorCount > 0 ? round2(dolorSum / dolorCount) : undefined;
  const esfuerzoPromedio =
    esfuerzoCount > 0 ? round2(esfuerzoSum / esfuerzoCount) : undefined;

  const existing = await ctx.db
    .query("dailyPatientRollup")
    .withIndex("by_pacienteId_clinicId_fecha", (q) =>
      q
        .eq("pacienteId", pacienteId)
        .eq("clinicId", clinicId)
        .eq("fecha", fecha),
    )
    .unique();

  const payload = {
    pacienteId,
    clinicId,
    fecha,
    planAggregates,
    totalEsperados,
    totalCompletados,
    totalExtras: counts.totalExtras,
    dolorPromedio,
    esfuerzoPromedio,
    estadoDia,
    sessionIds: sessions.map((s) => s._id),
    actualizadoEn: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
  } else {
    await ctx.db.insert("dailyPatientRollup", payload);
  }
}

async function markWeeklyStale(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  clinicId: Id<"clinics">,
  anioSemana: string,
): Promise<void> {
  const existing = await ctx.db
    .query("weeklyPatientRollup")
    .withIndex("by_pacienteId_clinicId_anioSemana", (q) =>
      q
        .eq("pacienteId", pacienteId)
        .eq("clinicId", clinicId)
        .eq("anioSemana", anioSemana),
    )
    .unique();
  if (existing) {
    if (!existing.stale) await ctx.db.patch(existing._id, { stale: true });
    return;
  }
  // Crear placeholder con stale=true para que el cron lo recompute.
  await ctx.db.insert("weeklyPatientRollup", {
    pacienteId,
    clinicId,
    anioSemana,
    diasCompletados: 0,
    diasParciales: 0,
    diasFallidos: 0,
    diasDescanso: 0,
    adherencia: 0,
    rachaMaxima: 0,
    sesionesCount: 0,
    actualizadoEn: 0,
    stale: true,
  });
}

async function markMonthlyStale(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  clinicId: Id<"clinics">,
  anioMesStr: string,
): Promise<void> {
  const existing = await ctx.db
    .query("monthlyPatientRollup")
    .withIndex("by_pacienteId_clinicId_anioMes", (q) =>
      q
        .eq("pacienteId", pacienteId)
        .eq("clinicId", clinicId)
        .eq("anioMes", anioMesStr),
    )
    .unique();
  if (existing) {
    if (!existing.stale) await ctx.db.patch(existing._id, { stale: true });
    return;
  }
  await ctx.db.insert("monthlyPatientRollup", {
    pacienteId,
    clinicId,
    anioMes: anioMesStr,
    diasCompletados: 0,
    diasParciales: 0,
    diasFallidos: 0,
    diasDescanso: 0,
    adherencia: 0,
    rachaMaxima: 0,
    sesionesCount: 0,
    actualizadoEn: 0,
    stale: true,
  });
}

/**
 * Procesa rollups semanales marcados como stale. Recompute desde
 * `dailyPatientRollup` × 7 días. Idempotente.
 */
export const processStaleWeeklyRollups = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ procesados: number }> => {
    const limit = args.batchSize ?? 200;
    const stale = await ctx.db
      .query("weeklyPatientRollup")
      .withIndex("by_stale", (q) => q.eq("stale", true))
      .take(limit);
    for (const w of stale) {
      await recomputeWeeklyImpl(ctx, w);
    }
    return { procesados: stale.length };
  },
});

async function recomputeWeeklyImpl(
  ctx: MutationCtx,
  rollup: Doc<"weeklyPatientRollup">,
): Promise<void> {
  const desde = startOfISOWeek(rollup.anioSemana);
  const hasta = endOfISOWeek(rollup.anioSemana);
  const dailies = await loadDailiesInRange(
    ctx,
    rollup.pacienteId,
    rollup.clinicId,
    desde,
    hasta,
  );

  const stats = await aggregateDailies(
    ctx,
    rollup.pacienteId,
    rollup.clinicId,
    dailies,
    desde,
    hasta,
  );
  await ctx.db.patch(rollup._id, {
    ...stats,
    actualizadoEn: Date.now(),
    stale: false,
  });
}

/**
 * Procesa rollups mensuales marcados como stale.
 */
export const processStaleMonthlyRollups = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ procesados: number }> => {
    const limit = args.batchSize ?? 200;
    const stale = await ctx.db
      .query("monthlyPatientRollup")
      .withIndex("by_stale", (q) => q.eq("stale", true))
      .take(limit);
    for (const m of stale) {
      await recomputeMonthlyImpl(ctx, m);
    }
    return { procesados: stale.length };
  },
});

async function recomputeMonthlyImpl(
  ctx: MutationCtx,
  rollup: Doc<"monthlyPatientRollup">,
): Promise<void> {
  const desde = startOfMonth(rollup.anioMes);
  const hasta = endOfMonth(rollup.anioMes);
  const dailies = await loadDailiesInRange(
    ctx,
    rollup.pacienteId,
    rollup.clinicId,
    desde,
    hasta,
  );

  const stats = await aggregateDailies(
    ctx,
    rollup.pacienteId,
    rollup.clinicId,
    dailies,
    desde,
    hasta,
  );

  // Tendencia vs mes anterior de la misma clínica.
  const prevAnioMes = previousAnioMes(rollup.anioMes);
  const prev = await ctx.db
    .query("monthlyPatientRollup")
    .withIndex("by_pacienteId_clinicId_anioMes", (q) =>
      q
        .eq("pacienteId", rollup.pacienteId)
        .eq("clinicId", rollup.clinicId)
        .eq("anioMes", prevAnioMes),
    )
    .unique();
  const tendenciaAdherencia = prev
    ? stats.adherencia - prev.adherencia
    : undefined;

  await ctx.db.patch(rollup._id, {
    ...stats,
    tendenciaAdherencia,
    actualizadoEn: Date.now(),
    stale: false,
  });
}

/**
 * Lee los dailies particionados de un paciente en una clínica para un rango
 * de fechas.
 */
async function loadDailiesInRange(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  clinicId: Id<"clinics">,
  desde: string,
  hasta: string,
): Promise<Doc<"dailyPatientRollup">[]> {
  return await ctx.db
    .query("dailyPatientRollup")
    .withIndex("by_pacienteId_clinicId_fecha", (q) =>
      q
        .eq("pacienteId", pacienteId)
        .eq("clinicId", clinicId)
        .gte("fecha", desde)
        .lte("fecha", hasta),
    )
    .collect();
}

interface AggregatedRange {
  diasCompletados: number;
  diasParciales: number;
  diasFallidos: number;
  diasDescanso: number;
  adherencia: number;
  dolorMedio?: number;
  dolorMax?: number;
  rachaMaxima: number;
  sesionesCount: number;
}

async function aggregateDailies(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  clinicId: Id<"clinics">,
  dailies: Doc<"dailyPatientRollup">[],
  desde: string,
  hasta: string,
): Promise<AggregatedRange> {
  // Map by fecha → daily.
  const byFecha = new Map<string, Doc<"dailyPatientRollup">>();
  for (const d of dailies) byFecha.set(d.fecha, d);

  // Recorrer todos los días del rango (rellenar huecos como sin_plan/descanso
  // dependiendo de si había plan ese día — por simplicidad: huecos como "sin_plan").
  const fechas = rangeOfDates(desde, hasta);
  const estadosDia: EstadoDia[] = [];
  let diasCompletados = 0;
  let diasParciales = 0;
  let diasFallidos = 0;
  let diasDescanso = 0;
  let dolorSum = 0;
  let dolorCount = 0;
  let dolorMax: number | undefined;

  for (const f of fechas) {
    const d = byFecha.get(f);
    if (!d) {
      estadosDia.push("sin_plan");
      continue;
    }
    estadosDia.push(d.estadoDia);
    if (d.estadoDia === "completado") diasCompletados += 1;
    else if (d.estadoDia === "parcial") diasParciales += 1;
    else if (d.estadoDia === "fallido") diasFallidos += 1;
    else if (d.estadoDia === "descanso") diasDescanso += 1;
    if (d.dolorPromedio !== undefined) {
      dolorSum += d.dolorPromedio;
      dolorCount += 1;
      if (dolorMax === undefined || d.dolorPromedio > dolorMax) {
        dolorMax = d.dolorPromedio;
      }
    }
  }

  // Adherencia estricta C/(C+P+F)·100 (misma fórmula que `snapshots/internal.ts`
  // y `cumplimiento.service.ts`). Sin denominador devolvemos 0 para mantener
  // `adherencia: number` y no romper el cálculo de `tendenciaAdherencia`.
  const diasConPlanNoDescanso =
    diasCompletados + diasParciales + diasFallidos;
  const adherencia =
    diasConPlanNoDescanso > 0
      ? Math.round((diasCompletados / diasConPlanNoDescanso) * 100)
      : 0;

  // Sesiones del rango (count) filtradas por clínica.
  const sesionesRaw = await ctx.db
    .query("sessions")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).gte("fecha", desde).lte("fecha", hasta),
    )
    .collect();
  const sesiones = sesionesRaw.filter((s) => s.clinicId === clinicId);
  const sesionesCount = sesiones.filter(
    (s) =>
      s.estado === "completada" ||
      s.estado === "completada_parcial" ||
      s.estado === "en_curso",
  ).length;

  return {
    diasCompletados,
    diasParciales,
    diasFallidos,
    diasDescanso,
    adherencia,
    dolorMedio: dolorCount > 0 ? round2(dolorSum / dolorCount) : undefined,
    dolorMax,
    rachaMaxima: computeRachaMaxima(estadosDia),
    sesionesCount,
  };
}

function previousAnioMes(anioMesStr: string): string {
  const [y, m] = anioMesStr.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────
// Materialización de rollups "fallidos" para pacientes activos
// (Bug 2 — AUDITORIA_AGGREGATES_CONVEX.md)
// ─────────────────────────────────────────────────────────────────────────

const MATERIALIZE_PATIENT_BATCH = 50;

/**
 * Para cada paciente activo en cada clínica, si no existe `dailyPatientRollup`
 * de ayer (Madrid), invoca `recomputeDayAndPropagateImpl`. `computeEstadoDia`
 * generará `fallido`/`descanso`/`sin_plan` según corresponda al plan vigente,
 * asegurando que los días sin sesión cuenten en la adherencia y aparezcan en
 * el timeline.
 *
 * Sin esto, los rollups solo se crean cuando el paciente abre la app: las
 * métricas resultantes (adherencia, racha) ignoran los días "no abiertos" y
 * por tanto inflan la adherencia real.
 *
 * Batchea pacientes con `ctx.scheduler.runAfter(0, ...)` cada
 * `MATERIALIZE_PATIENT_BATCH` para no exceder límites de transacción.
 * Invocado por el cron `daily-materialize-missing-rollups` a las 02:30 UTC,
 * entre `nightly-session-close` y `daily-maintenance`.
 */
export const materializeMissingDailyRollupsForYesterday = internalMutation({
  args: {
    fecha: v.optional(v.string()),
    cursorClinic: v.optional(v.id("clinics")),
    skipPatients: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    materializados: number;
    procesados: number;
    completado: boolean;
  }> => {
    const fecha = args.fecha ?? getMadridDateOffset(-1);
    const skip = args.skipPatients ?? 0;

    const paresOrdenados = await listActivePatientPairsAfter(
      ctx,
      args.cursorClinic,
    );
    const pares = paresOrdenados.slice(skip);

    let materializados = 0;
    let procesados = 0;
    for (const { pacienteId, clinicId } of pares) {
      if (procesados >= MATERIALIZE_PATIENT_BATCH) {
        await ctx.scheduler.runAfter(
          0,
          internal.rollups.internal.materializeMissingDailyRollupsForYesterday,
          {
            fecha,
            cursorClinic: clinicId,
            skipPatients: skip + procesados,
          },
        );
        return { materializados, procesados, completado: false };
      }
      procesados += 1;

      const existing = await ctx.db
        .query("dailyPatientRollup")
        .withIndex("by_pacienteId_clinicId_fecha", (q) =>
          q
            .eq("pacienteId", pacienteId)
            .eq("clinicId", clinicId)
            .eq("fecha", fecha),
        )
        .unique();
      if (existing) continue;

      await recomputeDayAndPropagateImpl(ctx, pacienteId, fecha);
      materializados += 1;
    }

    console.log(
      `[materialize-missing-rollups] fecha=${fecha} procesados=${procesados} materializados=${materializados} completado=true`,
    );
    return { materializados, procesados, completado: true };
  },
});

/**
 * Devuelve la lista ordenada de pares `(pacienteId, clinicId)` con plan en
 * curso, leída del aggregate `patientsWithActivePlanByClinic`. La ordenación
 * `(clinicId, pacienteId)` es estable para que el batching por cursor
 * `cursorClinic` + `skipPatients` no salte ni repita pares entre llamadas
 * encadenadas.
 */
async function listActivePatientPairsAfter(
  ctx: MutationCtx,
  cursorClinic: Id<"clinics"> | undefined,
): Promise<Array<{ pacienteId: Id<"users">; clinicId: Id<"clinics"> }>> {
  const pares: Array<{ pacienteId: Id<"users">; clinicId: Id<"clinics"> }> = [];
  for await (const clinicId of patientsWithActivePlanByClinic.iterNamespaces(
    ctx,
  )) {
    if (cursorClinic && clinicId < cursorClinic) continue;
    const { page } = await patientsWithActivePlanByClinic.paginate(ctx, {
      namespace: clinicId,
      pageSize: 1000,
    });
    for (const entry of page) {
      pares.push({ pacienteId: entry.id, clinicId });
    }
  }
  return pares;
}
