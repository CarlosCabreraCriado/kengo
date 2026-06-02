/**
 * Migración (sub-fase 3b): rellena `dailyPatientRollup.clinicId` particionando
 * los rollups legados por clínica.
 *
 * Estrategia:
 *   Para cada `(pacienteId, fecha)` con al menos un rollup legacy
 *   (sin `clinicId`), recomputar desde `exerciseExecutions` (que sí tienen
 *   `clinicId` obligatorio) creando dailies particionados por clínica.
 *   Luego borrar los rollups legacy de ese (paciente, fecha).
 *
 * Idempotente: si el (paciente, clínica, fecha) ya tiene un daily
 * particionado, el upsert lo deja igual.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillDailyByClinic:run
 *   npx convex run migrations/backfillDailyByClinic:run --prod
 *
 * En producción puede ser necesario ejecutarlo varias veces si la BD es
 * grande — el `batchSize` por defecto procesa hasta 500 dailies legacy por
 * ejecución para no exceder los límites de Convex.
 */

import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import {
  getActivePlansForPatientOnDate,
  getExpectedExercisesForPatientOnDate,
  sumExpectedByPlan,
} from "../_helpers/expectedExercises";
import { computeEstadoDia } from "../_helpers/rollupComputation";
import { getDiaSemana } from "../_helpers/datetime";

interface Resultado {
  procesados: number;
  recomputados: number;
  dailiesLegacyBorrados: number;
  paresSinActividad: number;
  pendientes: { pacienteId: Id<"users">; fecha: string; motivo: string }[];
}

export const run = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Resultado> => {
    const limit = args.batchSize ?? 500;
    const legacy = await ctx.db
      .query("dailyPatientRollup")
      .filter((q) => q.eq(q.field("clinicId"), undefined))
      .take(limit);

    // Agrupamos por (pacienteId, fecha) para procesar cada combinación una sola
    // vez (puede haber duplicados legacy si en algún momento se insertó dos
    // veces, aunque la lógica original lo evitaba).
    const paresMap = new Map<string, { pacienteId: Id<"users">; fecha: string }>();
    for (const d of legacy) {
      const key = `${d.pacienteId}|${d.fecha}`;
      if (!paresMap.has(key)) {
        paresMap.set(key, { pacienteId: d.pacienteId, fecha: d.fecha });
      }
    }

    let recomputados = 0;
    let paresSinActividad = 0;
    const pendientes: Resultado["pendientes"] = [];

    for (const { pacienteId, fecha } of paresMap.values()) {
      const ok = await recomputeAndPartitionDay(ctx, pacienteId, fecha);
      if (ok.recomputados > 0) recomputados += ok.recomputados;
      else if (ok.motivo) {
        if (ok.motivo === "sin_actividad") paresSinActividad += 1;
        else pendientes.push({ pacienteId, fecha, motivo: ok.motivo });
      }
    }

    // Tras particionar, borrar todos los rollups legacy procesados.
    let dailiesLegacyBorrados = 0;
    for (const d of legacy) {
      // Vuelve a leerse para confirmar que sigue siendo legacy (el upsert no
      // toca rollups legacy: crea nuevos con clinicId).
      const stillLegacy = await ctx.db.get(d._id);
      if (stillLegacy && !stillLegacy.clinicId) {
        await ctx.db.delete(d._id);
        dailiesLegacyBorrados += 1;
      }
    }

    console.log(
      `[backfillDailyByClinic] procesados=${paresMap.size} ` +
        `recomputados=${recomputados} ` +
        `dailiesLegacyBorrados=${dailiesLegacyBorrados} ` +
        `paresSinActividad=${paresSinActividad} ` +
        `pendientes=${pendientes.length}`,
    );

    return {
      procesados: paresMap.size,
      recomputados,
      dailiesLegacyBorrados,
      paresSinActividad,
      pendientes,
    };
  },
});

async function recomputeAndPartitionDay(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  fecha: string,
): Promise<{ recomputados: number; motivo?: string }> {
  // 1. Cargar fuentes con clinicId obligatorio.
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).eq("fecha", fecha),
    )
    .collect();
  const executions = await ctx.db
    .query("exerciseExecutions")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).eq("fecha", fecha),
    )
    .collect();
  const planes = await getActivePlansForPatientOnDate(ctx, pacienteId, fecha);

  // 2. Agrupar planes por clínica (descartando planes legacy sin clinicId —
  //    el backfillPlanClinicId los aborda).
  const planesByClinic = new Map<Id<"clinics">, Doc<"plans">[]>();
  for (const p of planes) {
    if (!p.clinicId) continue;
    const arr = planesByClinic.get(p.clinicId) ?? [];
    arr.push(p);
    planesByClinic.set(p.clinicId, arr);
  }

  // 3. Conjunto de clínicas con actividad ese día.
  const clinicIdsConActividad = new Set<Id<"clinics">>();
  for (const s of sessions) clinicIdsConActividad.add(s.clinicId);
  for (const e of executions) clinicIdsConActividad.add(e.clinicId);
  for (const cId of planesByClinic.keys()) clinicIdsConActividad.add(cId);

  if (clinicIdsConActividad.size === 0) {
    return { recomputados: 0, motivo: "sin_actividad" };
  }

  // 4. Particionar y upsert por clínica.
  const diaSemana = getDiaSemana(fecha);
  let recomputados = 0;
  for (const clinicId of clinicIdsConActividad) {
    await upsertDailyForClinic(ctx, {
      pacienteId,
      clinicId,
      fecha,
      diaSemana,
      sessions: sessions.filter((s) => s.clinicId === clinicId),
      executions: executions.filter((e) => e.clinicId === clinicId),
      planes: planesByClinic.get(clinicId) ?? [],
    });
    recomputados += 1;
  }

  return { recomputados };
}

interface UpsertDailyInput {
  pacienteId: Id<"users">;
  clinicId: Id<"clinics">;
  fecha: string;
  diaSemana: ReturnType<typeof getDiaSemana>;
  sessions: Doc<"sessions">[];
  executions: Doc<"exerciseExecutions">[];
  planes: Doc<"plans">[];
}

async function upsertDailyForClinic(
  ctx: MutationCtx,
  input: UpsertDailyInput,
): Promise<void> {
  const { pacienteId, clinicId, fecha, diaSemana, sessions, executions, planes } =
    input;

  const expected = await getExpectedExercisesForPatientOnDate(
    ctx,
    pacienteId,
    fecha,
    diaSemana,
    clinicId,
  );
  const { totalEsperados, porPlan: esperadosPorPlan } =
    sumExpectedByPlan(expected);

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

  const round2 = (n: number) => Math.round(n * 100) / 100;
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
