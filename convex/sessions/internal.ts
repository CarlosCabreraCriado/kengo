import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  getClinicIdForPatient,
  getExpectedExercisesForPatientOnDate,
  sumExpectedByPlan,
} from "../_helpers/expectedExercises";
import {
  computeAggregatesFromExecutions,
  ExecutionAggregateInput,
} from "../_helpers/rollupComputation";
import { getCurrentMadridDate, getDiaSemana } from "../_helpers/datetime";

const AS2_DOLOR_ALTO_THRESHOLD = 8;

/**
 * Apertura o reanudación implícita de la sesión del día para un paciente.
 *
 * - Si existe sesión `en_curso` para (paciente, fecha) → la devuelve.
 * - Si existe sesión `completada`/`completada_parcial` → la reabre y devuelve.
 * - Si no existe → crea una nueva con planIds = planes activos del paciente
 *   ese día y `totalEsperados` calculado.
 *
 * Idempotente: llamarla varias veces con la misma (paciente, fecha) devuelve
 * el mismo sessionId.
 */
export const openOrResume = internalMutation({
  args: {
    pacienteId: v.id("users"),
    fecha: v.string(),
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args): Promise<Id<"sessions">> => {
    return await openOrResumeImpl(ctx, args.pacienteId, args.fecha, args.clinicId);
  },
});

/**
 * Si `clinicId` se proporciona, la sesión se atribuye estrictamente a esa
 * clínica y los `expectedExercises` se filtran a planes de esa clínica
 * (aislamiento multiclinica). Si se omite, recae en la primera clínica del
 * paciente (comportamiento legacy, mantenido para compatibilidad mientras
 * el frontend pasa a enviarlo siempre).
 */
export async function openOrResumeImpl(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  fecha: string,
  clinicIdArg?: Id<"clinics">,
): Promise<Id<"sessions">> {
  const existing = await ctx.db
    .query("sessions")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).eq("fecha", fecha),
    )
    .first();

  if (existing) {
    if (existing.estado === "en_curso") return existing._id;
    // Reapertura: vuelve a en_curso. No tocamos agregados ni totalEsperados;
    // se recalcularán al insertar nueva ejecución.
    await ctx.db.patch(existing._id, {
      estado: "en_curso",
      motivoCierre: undefined,
      fechaFin: undefined,
    });
    return existing._id;
  }

  const clinicId =
    clinicIdArg ?? (await getClinicIdForPatient(ctx, pacienteId));
  if (!clinicId) {
    throw new Error(
      `openOrResume: paciente ${pacienteId} no tiene clinicId (sin membership)`,
    );
  }

  // No existe → crear nueva sesión. Los ejercicios esperados se restringen
  // a los planes de la clínica activa.
  const diaSemana = getDiaSemana(fecha);
  const expectedItems = await getExpectedExercisesForPatientOnDate(
    ctx,
    pacienteId,
    fecha,
    diaSemana,
    clinicId,
  );
  const { totalEsperados } = sumExpectedByPlan(expectedItems);
  const planIds = Array.from(new Set(expectedItems.map((e) => e.planId)));

  const sessionId = await ctx.db.insert("sessions", {
    pacienteId,
    fechaInicio: new Date().toISOString(),
    clinicId,
    planIds,
    fecha,
    estado: "en_curso",
    totalEsperados,
    totalCompletados: 0,
  });
  return sessionId;
}

/**
 * Recompute idempotente de los agregados de la sesión a partir de sus
 * `exerciseExecutions`. Si tras la recomputación
 * `totalCompletados >= totalEsperados`, dispara el auto-cierre por
 * completitud.
 */
export const recomputeAggregatesAndCheckAutoClose = internalMutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args): Promise<void> => {
    await recomputeAggregatesAndCheckAutoCloseImpl(ctx, args.sessionId);
  },
});

export async function recomputeAggregatesAndCheckAutoCloseImpl(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
): Promise<void> {
  const session = await ctx.db.get(sessionId);
  if (!session) return;

  const executions = await ctx.db
    .query("exerciseExecutions")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .collect();

  const aggInputs: ExecutionAggregateInput[] = executions.map((e) => ({
    completado: e.completado,
    dolorEscala: e.dolorEscala,
    esfuerzoEscala: e.esfuerzoEscala,
    duracionRealSeg: e.duracionRealSeg,
  }));
  const agg = computeAggregatesFromExecutions(aggInputs);

  await ctx.db.patch(sessionId, {
    totalCompletados: agg.totalCompletados,
    duracionTotalSeg: agg.duracionTotalSeg,
    dolorMin: agg.dolorMin,
    dolorMax: agg.dolorMax,
    dolorPromedio: agg.dolorPromedio,
    esfuerzoPromedio: agg.esfuerzoPromedio,
  });

  const totalEsperados = session.totalEsperados ?? 0;
  if (
    session.estado === "en_curso" &&
    totalEsperados > 0 &&
    agg.totalCompletados >= totalEsperados
  ) {
    await closeImpl(ctx, sessionId, "auto_completitud");
  }
}

/**
 * Cierra una sesión:
 * - Update estado, motivoCierre, fechaFin.
 * - Trigger rollups.recomputeDayAndPropagate.
 * - Trigger snapshots.recomputePatient + recomputeClinic (BN3 tiempo real).
 * - Trigger alerts.createDolorAltoAlert si dolorMax >= AS2.
 */
export const close = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    motivoCierre: v.union(
      v.literal("auto_completitud"),
      v.literal("cron_nocturno"),
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    await closeImpl(ctx, args.sessionId, args.motivoCierre);
  },
});

export async function closeImpl(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  motivoCierre: "auto_completitud" | "cron_nocturno",
): Promise<void> {
  const session = await ctx.db.get(sessionId);
  if (!session) return;
  if (session.fecha === undefined) return; // sesión legacy sin fecha → no aplica

  const totalEsperados = session.totalEsperados ?? 0;
  const totalCompletados = session.totalCompletados ?? 0;
  const estado: "completada" | "completada_parcial" =
    totalEsperados > 0 && totalCompletados >= totalEsperados
      ? "completada"
      : "completada_parcial";

  await ctx.db.patch(sessionId, {
    estado,
    motivoCierre,
    fechaFin: new Date().toISOString(),
  });

  // Trigger rollups (recompute day + mark stale weekly/monthly).
  await ctx.runMutation(internal.rollups.internal.recomputeDayAndPropagate, {
    pacienteId: session.pacienteId,
    fecha: session.fecha,
  });

  // Trigger snapshots (BN3: tiempo real). Se hacen síncronos.
  if (session.clinicId) {
    await ctx.runMutation(internal.snapshots.internal.recomputePatient, {
      pacienteId: session.pacienteId,
    });
    await ctx.runMutation(internal.snapshots.internal.recomputeClinic, {
      clinicId: session.clinicId,
    });
  }

  // Alerta dolor_alto si dolorMax >= AS2 (default 8).
  if (
    session.dolorMax !== undefined &&
    session.dolorMax >= AS2_DOLOR_ALTO_THRESHOLD &&
    session.clinicId
  ) {
    await ctx.runMutation(internal.alerts.internal.createDolorAltoAlert, {
      pacienteId: session.pacienteId,
      sessionId,
      dolorEscala: session.dolorMax,
    });
  }
}

/**
 * Invocado por el cron `nightly-session-close`. Cierra como
 * `completada_parcial` todas las sesiones `en_curso` cuya `fecha` sea
 * anterior a la fecha actual de Madrid.
 */
export const closeOpenSessionsAtEndOfDay = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ cerradas: number }> => {
    const hoy = getCurrentMadridDate();
    const abiertas = (await ctx.db.query("sessions").collect()).filter(
      (s) => s.estado === "en_curso",
    );

    let cerradas = 0;
    for (const s of abiertas) {
      // Solo cerramos las sesiones cuya `fecha` es estrictamente anterior
      // a hoy. Sesiones con fecha=hoy siguen abiertas (cron correrá mañana).
      if (!s.fecha || s.fecha >= hoy) continue;
      await closeImpl(ctx, s._id, "cron_nocturno");
      cerradas += 1;
    }
    console.log(
      `[nightly-session-close] hoy=${hoy} cerradas=${cerradas}/${abiertas.length}`,
    );
    return { cerradas };
  },
});
