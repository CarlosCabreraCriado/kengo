import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import {
  getActivePlansForPatientOnDate,
  getExpectedExercisesForPatientOnDate,
  sumExpectedByPlan,
} from "../_helpers/expectedExercises";
import {
  anioMes,
  anioSemanaISO,
  endOfISOWeek,
  endOfMonth,
  getDiaSemana,
  rangeOfDates,
  startOfISOWeek,
  startOfMonth,
} from "../_helpers/datetime";
import {
  computeEstadoDia,
  computeRachaMaxima,
  EstadoDia,
} from "../_helpers/rollupComputation";

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
  // 1. Sesiones del día.
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).eq("fecha", fecha),
    )
    .collect();
  const sessionIds = sessions.map((s) => s._id);

  // 2. Ejecuciones del día (más eficiente leer por (paciente, fecha) que
  //    iterar por sesión: el índice by_pacienteId_fecha cubre el rango).
  const executions = await ctx.db
    .query("exerciseExecutions")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).eq("fecha", fecha),
    )
    .collect();

  // 3. Esperados desde planes activos.
  const planes = await getActivePlansForPatientOnDate(ctx, pacienteId, fecha);
  const diaSemana = getDiaSemana(fecha);
  const expected = await getExpectedExercisesForPatientOnDate(
    ctx,
    pacienteId,
    fecha,
    diaSemana,
  );
  const { totalEsperados, porPlan: esperadosPorPlan } =
    sumExpectedByPlan(expected);

  // 4. Completados por plan + dolor por plan.
  const completadosPorPlan = new Map<Id<"plans">, number>();
  const doloresPorPlan = new Map<Id<"plans">, number[]>();
  let totalCompletados = 0;
  let dolorSum = 0;
  let dolorCount = 0;
  let esfuerzoSum = 0;
  let esfuerzoCount = 0;
  for (const ex of executions) {
    if (ex.completado) {
      totalCompletados += 1;
      completadosPorPlan.set(
        ex.planId,
        (completadosPorPlan.get(ex.planId) ?? 0) + 1,
      );
    }
    if (ex.dolorEscala !== undefined) {
      dolorSum += ex.dolorEscala;
      dolorCount += 1;
      const arr = doloresPorPlan.get(ex.planId) ?? [];
      arr.push(ex.dolorEscala);
      doloresPorPlan.set(ex.planId, arr);
    }
    if (ex.esfuerzoEscala !== undefined) {
      esfuerzoSum += ex.esfuerzoEscala;
      esfuerzoCount += 1;
    }
  }

  const planAggregates = planes.map((p) => {
    const dolores = doloresPorPlan.get(p._id);
    const dolorMedio =
      dolores && dolores.length > 0
        ? round2(dolores.reduce((a, b) => a + b, 0) / dolores.length)
        : undefined;
    return {
      planId: p._id,
      esperados: esperadosPorPlan.get(p._id) ?? 0,
      completados: completadosPorPlan.get(p._id) ?? 0,
      dolorMedio,
    };
  });

  const estadoDia = computeEstadoDia(
    totalEsperados,
    totalCompletados,
    planes.length > 0,
  );
  const dolorPromedio = dolorCount > 0 ? round2(dolorSum / dolorCount) : undefined;
  const esfuerzoPromedio =
    esfuerzoCount > 0 ? round2(esfuerzoSum / esfuerzoCount) : undefined;

  // 5. Upsert dailyPatientRollup.
  const existing = await ctx.db
    .query("dailyPatientRollup")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).eq("fecha", fecha),
    )
    .unique();

  const payload = {
    pacienteId,
    fecha,
    planAggregates,
    totalEsperados,
    totalCompletados,
    dolorPromedio,
    esfuerzoPromedio,
    estadoDia,
    sessionIds,
    actualizadoEn: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
  } else {
    await ctx.db.insert("dailyPatientRollup", payload);
  }

  // 6. Marcar stale weekly + monthly correspondientes.
  await markWeeklyStale(ctx, pacienteId, anioSemanaISO(fecha));
  await markMonthlyStale(ctx, pacienteId, anioMes(fecha));
}

async function markWeeklyStale(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  anioSemana: string,
): Promise<void> {
  const existing = await ctx.db
    .query("weeklyPatientRollup")
    .withIndex("by_pacienteId_anioSemana", (q) =>
      q.eq("pacienteId", pacienteId).eq("anioSemana", anioSemana),
    )
    .unique();
  if (existing) {
    if (!existing.stale) await ctx.db.patch(existing._id, { stale: true });
    return;
  }
  // Crear placeholder con stale=true para que el cron lo recompute.
  await ctx.db.insert("weeklyPatientRollup", {
    pacienteId,
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
  anioMesStr: string,
): Promise<void> {
  const existing = await ctx.db
    .query("monthlyPatientRollup")
    .withIndex("by_pacienteId_anioMes", (q) =>
      q.eq("pacienteId", pacienteId).eq("anioMes", anioMesStr),
    )
    .unique();
  if (existing) {
    if (!existing.stale) await ctx.db.patch(existing._id, { stale: true });
    return;
  }
  await ctx.db.insert("monthlyPatientRollup", {
    pacienteId,
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
  const dailies = await ctx.db
    .query("dailyPatientRollup")
    .withIndex("by_pacienteId_fecha", (q) =>
      q
        .eq("pacienteId", rollup.pacienteId)
        .gte("fecha", desde)
        .lte("fecha", hasta),
    )
    .collect();

  const stats = await aggregateDailies(ctx, rollup.pacienteId, dailies, desde, hasta);
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
  const dailies = await ctx.db
    .query("dailyPatientRollup")
    .withIndex("by_pacienteId_fecha", (q) =>
      q
        .eq("pacienteId", rollup.pacienteId)
        .gte("fecha", desde)
        .lte("fecha", hasta),
    )
    .collect();

  const stats = await aggregateDailies(ctx, rollup.pacienteId, dailies, desde, hasta);

  // Tendencia vs mes anterior.
  const prevAnioMes = previousAnioMes(rollup.anioMes);
  const prev = await ctx.db
    .query("monthlyPatientRollup")
    .withIndex("by_pacienteId_anioMes", (q) =>
      q.eq("pacienteId", rollup.pacienteId).eq("anioMes", prevAnioMes),
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

  // Sesiones del rango (count): index by_pacienteId_fecha.
  const sesiones = await ctx.db
    .query("sessions")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).gte("fecha", desde).lte("fecha", hasta),
    )
    .collect();
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
