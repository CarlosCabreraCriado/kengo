/**
 * Migración de reparación: recalcula los denormalizados y el estado de TODAS
 * las sesiones pasadas con el conteo canónico por IDENTIDAD
 * (`computeDayCounts`), y recomputa los rollups diarios afectados.
 *
 * Contexto (auditoría 2026-07-13 sobre producción): 89/379 sesiones con
 * `totalCompletados > totalEsperados`, 142 sesiones con ejecuciones de planes
 * ajenos a `session.planIds` y 49 pares duplicados. Causas ya corregidas en
 * runtime: fallback del player a ejercicios no programados, autocierre por
 * cardinalidad, versionado retroactivo de planes e idempotencia débil.
 *
 * Reglas de reparación (mismas que el runtime):
 * - Esperados del día = `getExpectedExercisesForPatientOnDate` con las fechas
 *   ACTUALES de los planes + matching cross-versión por `exerciseId` como
 *   fallback (la vigencia histórica original es irrecuperable tras los clamps
 *   retroactivos; esta es también la vista que usan rollups/UI).
 * - `totalCompletados` = esperados matcheados (dedup); `totalExtras` aparte.
 * - `estado` = `computeEstadoSesion` (identidad).
 * - `planIds` = planes del conjunto esperado.
 * - NO se tocan `motivoCierre`, `fechaInicio`, `fechaFin`,
 *   `observacionesPaciente` ni las filas de `exerciseExecutions` (los
 *   duplicados quedan; el conteo los ignora por dedup lógico).
 * - Sesiones de HOY o `en_curso` no se tocan (las normaliza el runtime/cron).
 *
 * Cada cambio queda auditado en `dataRepairAudit` (antes/después JSON).
 *
 * Orden operativo (ver plan de corrección):
 *   0) Backup:  npx convex export --path ./backups/kengo-prod-pre-repair-<fecha>.zip
 *   1) Dry-run: npx convex run migrations/repairSessionsIntegrity:dryRun '{"muestras": 20}'
 *      Caso de aceptación:
 *      npx convex run migrations/repairSessionsIntegrity:inspectSession \
 *        '{"sessionId":"md7675bjfn0hx1mtw0dw54jx9n89jeeq"}'
 *   2) Ejecutar:
 *      npx convex run migrations/repairSessionsIntegrity:run \
 *        '{"fn":"migrations/repairSessionsIntegrity:backfill","batchSize":10}'
 *   3) Drenar stale (repetir hasta procesados < batchSize):
 *      npx convex run rollups/internal:processStaleWeeklyRollups '{"batchSize":100}'
 *      npx convex run rollups/internal:processStaleMonthlyRollups '{"batchSize":100}'
 *   4) Snapshots:
 *      npx convex run snapshots/internal:recomputeAllPatients
 *      npx convex run snapshots/internal:recomputeAllClinics
 *   5) Validar: npx convex run migrations/repairSessionsIntegrity:validate
 */

import { v } from "convex/values";
import { FunctionReference } from "convex/server";
import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "../_generated/api";
import { DataModel, Doc } from "../_generated/dataModel";
import {
  internalAction,
  internalQuery,
  QueryCtx,
} from "../_generated/server";
import { internalMutation } from "../_helpers/mutationWithTriggers";
import { getCurrentMadridDate } from "../_helpers/datetime";
import { computeAggregatesFromExecutions } from "../_helpers/rollupComputation";
import { computeEstadoSesion } from "../_helpers/sessionCounting";
import { computeDayCountsForPatient } from "../_helpers/sessionCountingDb";
import { recomputeDayAndPropagateImpl } from "../rollups/internal";

// La migración parchea `sessions` (tabla con triggers de aggregates):
// obligatorio construir el componente con la internalMutation envuelta
// (ver `_helpers/mutationWithTriggers.ts`).
const migrations = new Migrations<DataModel>(components.migrations, {
  internalMutation,
});

// `_generated/api.d.ts` no incluye este módulo hasta el próximo codegen
// (que en este proyecto solo se ejecuta como parte del deploy — nunca
// lanzar `npx convex codegen` suelto: hace push a producción). El proxy
// runtime de `internal` sí resuelve el módulo; este alias tipado evita el
// error de tipos sin regenerar antes de tiempo.
const selfInternal = (
  internal.migrations as Record<string, Record<string, unknown>>
)["repairSessionsIntegrity"] as {
  dryRunPage: FunctionReference<"query", "internal">;
  validatePage: FunctionReference<"query", "internal">;
  countStaleRollups: FunctionReference<"query", "internal">;
};

export const MIGRACION = "repairSessionsIntegrity/2026-07";

interface SessionSnapshot {
  estado: string;
  totalEsperados: number | null;
  totalCompletados: number | null;
  totalExtras: number | null;
  planIds: string[];
}

interface SessionRepairProposal {
  sessionId: Doc<"sessions">["_id"];
  pacienteId: Doc<"sessions">["pacienteId"];
  clinicId: Doc<"sessions">["clinicId"];
  fecha: string;
  antes: SessionSnapshot;
  despues: SessionSnapshot & {
    duracionTotalSeg?: number;
    dolorMin?: number;
    dolorMax?: number;
    dolorPromedio?: number;
    esfuerzoPromedio?: number;
  };
  duplicadosDetectados: number;
  cambia: boolean;
}

type AnalyzeResult =
  | { skip: "hoy_o_futura" | "en_curso" | "sin_fecha" }
  | { skip: null; proposal: SessionRepairProposal };

async function analyzeSessionImpl(
  ctx: QueryCtx,
  session: Doc<"sessions">,
  hoy: string,
): Promise<AnalyzeResult> {
  if (!session.fecha) return { skip: "sin_fecha" };
  if (session.fecha >= hoy) return { skip: "hoy_o_futura" };
  if (session.estado === "en_curso") return { skip: "en_curso" };

  const executions = await ctx.db
    .query("exerciseExecutions")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
    .collect();

  const { counts, expected } = await computeDayCountsForPatient(ctx, {
    pacienteId: session.pacienteId,
    fecha: session.fecha,
    clinicId: session.clinicId,
    executions,
  });
  const agg = computeAggregatesFromExecutions(counts.dedupExecutions);
  const planIds = Array.from(new Set(expected.map((e) => e.planId)));
  const estado = computeEstadoSesion(counts);

  const antes: SessionSnapshot = {
    estado: session.estado,
    totalEsperados: session.totalEsperados ?? null,
    totalCompletados: session.totalCompletados ?? null,
    totalExtras: session.totalExtras ?? null,
    planIds: (session.planIds ?? []).map(String),
  };
  const despues: SessionRepairProposal["despues"] = {
    estado,
    totalEsperados: counts.totalEsperados,
    totalCompletados: counts.totalCompletados,
    totalExtras: counts.totalExtras,
    planIds: planIds.map(String),
    duracionTotalSeg: agg.duracionTotalSeg,
    dolorMin: agg.dolorMin,
    dolorMax: agg.dolorMax,
    dolorPromedio: agg.dolorPromedio,
    esfuerzoPromedio: agg.esfuerzoPromedio,
  };

  const cambia =
    antes.estado !== despues.estado ||
    antes.totalEsperados !== despues.totalEsperados ||
    antes.totalCompletados !== despues.totalCompletados ||
    (antes.totalExtras ?? 0) !== despues.totalExtras ||
    antes.planIds.slice().sort().join(",") !==
      despues.planIds.slice().sort().join(",");

  // Grupos con más de una ejecución completada del mismo planExercise.
  const completadasPorPe = new Map<string, number>();
  for (const e of executions) {
    if (!e.completado) continue;
    completadasPorPe.set(
      e.planExerciseId,
      (completadasPorPe.get(e.planExerciseId) ?? 0) + 1,
    );
  }
  const duplicadosDetectados = Array.from(completadasPorPe.values()).filter(
    (n) => n > 1,
  ).length;

  return {
    skip: null,
    proposal: {
      sessionId: session._id,
      pacienteId: session.pacienteId,
      clinicId: session.clinicId,
      fecha: session.fecha,
      antes,
      despues,
      duplicadosDetectados,
      cambia,
    },
  };
}

// ─── Migración principal ───

export const backfill = migrations.define({
  table: "sessions",
  migrateOne: async (ctx, session) => {
    const hoy = getCurrentMadridDate();
    const result = await analyzeSessionImpl(ctx, session, hoy);
    if (result.skip) return;
    const { proposal } = result;

    if (proposal.cambia) {
      const d = proposal.despues;
      await ctx.db.patch(session._id, {
        estado: d.estado as "completada" | "completada_parcial",
        totalEsperados: d.totalEsperados ?? 0,
        totalCompletados: d.totalCompletados ?? 0,
        totalExtras: d.totalExtras ?? 0,
        planIds: proposal.despues.planIds as Doc<"sessions">["planIds"],
        duracionTotalSeg: d.duracionTotalSeg,
        dolorMin: d.dolorMin,
        dolorMax: d.dolorMax,
        dolorPromedio: d.dolorPromedio,
        esfuerzoPromedio: d.esfuerzoPromedio,
      });

      // Auditoría (upsert idempotente: `antes` solo en la primera pasada).
      const existing = await ctx.db
        .query("dataRepairAudit")
        .withIndex("by_migracion_sessionId", (q) =>
          q.eq("migracion", MIGRACION).eq("sessionId", session._id),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          despues: JSON.stringify(proposal.despues),
        });
      } else {
        await ctx.db.insert("dataRepairAudit", {
          migracion: MIGRACION,
          sessionId: session._id,
          pacienteId: session.pacienteId,
          clinicId: session.clinicId,
          fecha: proposal.fecha,
          antes: JSON.stringify(proposal.antes),
          despues: JSON.stringify(proposal.despues),
          createdAt: Date.now(),
        });
      }
    }

    // Recompute del rollup del día SIEMPRE (aunque la sesión no cambie): los
    // dailies históricos se calcularon con la semántica vieja (cardinalidad,
    // sin dedup ni extras) y deben regenerarse con la nueva. Marca
    // weekly/monthly stale; el paso 3 del runbook los drena.
    await recomputeDayAndPropagateImpl(
      ctx,
      session.pacienteId,
      session.fecha,
    );
  },
});

export const run = migrations.runner();

// ─── Dry-run ───

export const dryRunPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoy = getCurrentMadridDate();
    const { page, isDone, continueCursor } = await ctx.db
      .query("sessions")
      .paginate({ cursor: args.cursor, numItems: args.numItems ?? 50 });

    const proposals: SessionRepairProposal[] = [];
    const skips = { hoy_o_futura: 0, en_curso: 0, sin_fecha: 0 };
    for (const session of page) {
      const result = await analyzeSessionImpl(ctx, session, hoy);
      if (result.skip) {
        skips[result.skip] += 1;
        continue;
      }
      proposals.push(result.proposal);
    }
    return { proposals, skips, isDone, continueCursor };
  },
});

export const dryRun = internalAction({
  args: { muestras: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const maxMuestras = args.muestras ?? 10;
    let cursor: string | null = null;
    let analizadas = 0;
    let conCambios = 0;
    let estadoCompletadaAParcial = 0;
    let estadoParcialACompletada = 0;
    let conExtras = 0;
    let totalExtras = 0;
    let conDuplicados = 0;
    const skips = { hoy_o_futura: 0, en_curso: 0, sin_fecha: 0 };
    const pacientesAfectados = new Set<string>();
    const muestras: SessionRepairProposal[] = [];

    for (;;) {
      const page: {
        proposals: SessionRepairProposal[];
        skips: typeof skips;
        isDone: boolean;
        continueCursor: string;
      } = await ctx.runQuery(
        selfInternal.dryRunPage,
        { cursor, numItems: 50 },
      );
      for (const p of page.proposals) {
        analizadas += 1;
        if (p.duplicadosDetectados > 0) conDuplicados += 1;
        if ((p.despues.totalExtras ?? 0) > 0) {
          conExtras += 1;
          totalExtras += p.despues.totalExtras ?? 0;
        }
        if (!p.cambia) continue;
        conCambios += 1;
        pacientesAfectados.add(String(p.pacienteId));
        if (p.antes.estado === "completada" && p.despues.estado === "completada_parcial") {
          estadoCompletadaAParcial += 1;
        }
        if (p.antes.estado === "completada_parcial" && p.despues.estado === "completada") {
          estadoParcialACompletada += 1;
        }
        if (muestras.length < maxMuestras) muestras.push(p);
      }
      skips.hoy_o_futura += page.skips.hoy_o_futura;
      skips.en_curso += page.skips.en_curso;
      skips.sin_fecha += page.skips.sin_fecha;
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    const resumen = {
      analizadas,
      conCambios,
      estadoCompletadaAParcial,
      estadoParcialACompletada,
      conExtras,
      totalExtras,
      conDuplicados,
      pacientesAfectados: pacientesAfectados.size,
      skips,
      muestras,
    };
    console.log(
      `[repairSessionsIntegrity:dryRun] ${JSON.stringify({ ...resumen, muestras: undefined })}`,
    );
    return resumen;
  },
});

// ─── Diagnóstico puntual ───

export const inspectSession = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return { error: "sesión no encontrada" };
    const hoy = getCurrentMadridDate();
    const result = await analyzeSessionImpl(ctx, session, hoy);
    const executions = await ctx.db
      .query("exerciseExecutions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return {
      session,
      executions: executions.map((e) => ({
        _id: e._id,
        planExerciseId: e.planExerciseId,
        planId: e.planId,
        completado: e.completado,
        fechaHora: e.fechaHora,
      })),
      analisis: result,
    };
  },
});

// ─── Validación post-migración ───

interface ValidationIssue {
  sessionId: string;
  fecha: string;
  problema: string;
  detalle: string;
}

export const validatePage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoy = getCurrentMadridDate();
    const { page, isDone, continueCursor } = await ctx.db
      .query("sessions")
      .paginate({ cursor: args.cursor, numItems: args.numItems ?? 50 });

    const issues: ValidationIssue[] = [];
    let validadas = 0;
    for (const session of page) {
      if (!session.fecha || session.fecha >= hoy) continue;
      if (session.estado === "en_curso") continue;
      validadas += 1;

      const esperados = session.totalEsperados ?? 0;
      const completados = session.totalCompletados ?? 0;
      if (completados > esperados) {
        issues.push({
          sessionId: String(session._id),
          fecha: session.fecha,
          problema: "completados_mayor_que_esperados",
          detalle: `${completados}/${esperados}`,
        });
      }

      const result = await analyzeSessionImpl(ctx, session, hoy);
      if (result.skip) continue;
      if (result.proposal.cambia) {
        issues.push({
          sessionId: String(session._id),
          fecha: session.fecha,
          problema: "denormalizados_desactualizados",
          detalle: `antes=${JSON.stringify(result.proposal.antes)} esperado=${JSON.stringify(
            {
              estado: result.proposal.despues.estado,
              totalEsperados: result.proposal.despues.totalEsperados,
              totalCompletados: result.proposal.despues.totalCompletados,
              totalExtras: result.proposal.despues.totalExtras,
            },
          )}`,
        });
        continue;
      }

      // Rollup del día coherente con la sesión reparada.
      const rollup = await ctx.db
        .query("dailyPatientRollup")
        .withIndex("by_pacienteId_clinicId_fecha", (q) =>
          q
            .eq("pacienteId", session.pacienteId)
            .eq("clinicId", session.clinicId)
            .eq("fecha", session.fecha),
        )
        .unique();
      if (!rollup) {
        issues.push({
          sessionId: String(session._id),
          fecha: session.fecha,
          problema: "rollup_ausente",
          detalle: `clinicId=${session.clinicId}`,
        });
      } else if (
        rollup.totalEsperados !== (session.totalEsperados ?? 0) ||
        rollup.totalCompletados !== (session.totalCompletados ?? 0)
      ) {
        issues.push({
          sessionId: String(session._id),
          fecha: session.fecha,
          problema: "rollup_incoherente",
          detalle: `rollup=${rollup.totalCompletados}/${rollup.totalEsperados} sesion=${session.totalCompletados}/${session.totalEsperados}`,
        });
      }
    }
    return { validadas, issues, isDone, continueCursor };
  },
});

export const validate = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    validadas: number;
    issuesCount: number;
    issues: ValidationIssue[];
    staleWeekly: number;
    staleMonthly: number;
  }> => {
    let cursor: string | null = null;
    let validadas = 0;
    const issues: ValidationIssue[] = [];

    for (;;) {
      const page: {
        validadas: number;
        issues: ValidationIssue[];
        isDone: boolean;
        continueCursor: string;
      } = await ctx.runQuery(
        selfInternal.validatePage,
        { cursor, numItems: 50 },
      );
      validadas += page.validadas;
      issues.push(...page.issues);
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    const staleWeekly: { staleWeekly: number; staleMonthly: number } =
      await ctx.runQuery(selfInternal.countStaleRollups, {});

    const resumen = {
      validadas,
      issuesCount: issues.length,
      issues: issues.slice(0, 50),
      ...staleWeekly,
    };
    console.log(
      `[repairSessionsIntegrity:validate] validadas=${validadas} issues=${issues.length} staleWeekly=${staleWeekly.staleWeekly} staleMonthly=${staleWeekly.staleMonthly}`,
    );
    return resumen;
  },
});

export const countStaleRollups = internalQuery({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ staleWeekly: number; staleMonthly: number }> => {
    const staleWeekly = await ctx.db
      .query("weeklyPatientRollup")
      .withIndex("by_stale", (q) => q.eq("stale", true))
      .take(1000);
    const staleMonthly = await ctx.db
      .query("monthlyPatientRollup")
      .withIndex("by_stale", (q) => q.eq("stale", true))
      .take(1000);
    return {
      staleWeekly: staleWeekly.length,
      staleMonthly: staleMonthly.length,
    };
  },
});
