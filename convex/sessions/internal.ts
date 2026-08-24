import { v } from "convex/values";
import { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_helpers/mutationWithTriggers";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  getClinicIdForPatient,
  getExpectedExercisesForPatientOnDate,
  sumExpectedByPlan,
} from "../_helpers/expectedExercises";
import { computeAggregatesFromExecutions } from "../_helpers/rollupComputation";
import {
  computeEstadoSesion,
  DayCounts,
} from "../_helpers/sessionCounting";
import { computeDayCountsForPatient } from "../_helpers/sessionCountingDb";
import {
  DEFAULT_TZ,
  getCurrentDateInTz,
  getDiaSemana,
  shouldCloseSession,
} from "../_helpers/datetime";
import { TzCache } from "../_helpers/patientTz";
import { Doc } from "../_generated/dataModel";

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

/**
 * Recomputa y persiste los denormalizados de la sesión con el conteo
 * canónico por IDENTIDAD (`computeDayCounts`):
 * - `totalEsperados` y `planIds` se refrescan SIEMPRE desde los planes
 *   vigentes hoy (autocorrige versionados a mitad de día).
 * - `totalCompletados` = esperados matcheados (dedup); `totalExtras` =
 *   completados no programados hoy.
 * - Agregados dolor/esfuerzo/duración sobre las ejecuciones dedup (una
 *   repetición fantasma no pondera el dolorPromedio).
 */
async function refreshSessionCounts(
  ctx: MutationCtx,
  session: Doc<"sessions">,
): Promise<DayCounts> {
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

  await ctx.db.patch(session._id, {
    totalEsperados: counts.totalEsperados,
    totalCompletados: counts.totalCompletados,
    totalExtras: counts.totalExtras,
    planIds,
    duracionTotalSeg: agg.duracionTotalSeg,
    dolorMin: agg.dolorMin,
    dolorMax: agg.dolorMax,
    dolorPromedio: agg.dolorPromedio,
    esfuerzoPromedio: agg.esfuerzoPromedio,
  });
  return counts;
}

export async function recomputeAggregatesAndCheckAutoCloseImpl(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
): Promise<void> {
  const session = await ctx.db.get(sessionId);
  if (!session) return;
  if (session.fecha === undefined) return; // sesión legacy sin fecha → no aplica

  const counts = await refreshSessionCounts(ctx, session);

  if (
    session.estado === "en_curso" &&
    counts.totalEsperados > 0 &&
    counts.totalCompletados >= counts.totalEsperados
  ) {
    await closeImpl(ctx, sessionId, "auto_completitud", counts);
  } else {
    // Sesión sigue abierta: mantener el rollup del día fresco para que el
    // detalle del paciente (badge "Inactivo", timeline) refleje la actividad
    // en curso sin esperar al cierre o al cron nocturno. `closeImpl` ya
    // dispara este mismo recompute al cerrar.
    await ctx.runMutation(internal.rollups.internal.recomputeDayAndPropagate, {
      pacienteId: session.pacienteId,
      fecha: session.fecha,
    });
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
  freshCounts?: DayCounts,
): Promise<void> {
  const session = await ctx.db.get(sessionId);
  if (!session) return;
  if (session.fecha === undefined) return; // sesión legacy sin fecha → no aplica

  // El estado se decide con el conteo por IDENTIDAD recién recomputado
  // (cubre también el caso legacy de sesión abierta antes de que existieran
  // los `planExercises`: los esperados se refrescan siempre). El caller que
  // acaba de refrescar (auto-cierre) pasa `freshCounts` para no recomputar.
  const counts = freshCounts ?? (await refreshSessionCounts(ctx, session));
  const estado = computeEstadoSesion(counts);

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

  // Alerta dolor_alto si dolorMax >= AS2 (default 8). Se relee el doc:
  // `refreshSessionCounts` puede haber actualizado `dolorMax` tras el
  // snapshot local de `session`.
  const dolorMax = (await ctx.db.get(sessionId))?.dolorMax;
  if (
    dolorMax !== undefined &&
    dolorMax >= AS2_DOLOR_ALTO_THRESHOLD &&
    session.clinicId
  ) {
    await ctx.runMutation(internal.alerts.internal.createDolorAltoAlert, {
      pacienteId: session.pacienteId,
      sessionId,
      dolorEscala: dolorMax,
    });
  }
}

/**
 * Invocado por el cron `nightly-session-close`. Cierra como
 * `completada_parcial` las sesiones `en_curso` cuyo día ya terminó EN LA TZ
 * DE SU PACIENTE.
 *
 * El barrido usa `fecha < hoyMadrid` como superset barato (índice), y después
 * filtra por TZ: a las 02:00 UTC el día aún está en curso para TZs por detrás
 * de Madrid (Canarias, América) — cerrarlas ahí truncaría el día del paciente.
 * Para TZs por delante de Madrid la sesión se cierra un ciclo más tarde
 * (inofensivo: sigue abierta unas horas extra, nada la reabre mal).
 */
export const closeOpenSessionsAtEndOfDay = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ cerradas: number }> => {
    const hoyMadrid = getCurrentDateInTz(DEFAULT_TZ);
    // Índice `by_estado_fecha`: solo las sesiones `en_curso` con fecha
    // estrictamente anterior a hoy-Madrid. Evita escanear toda la tabla.
    const abiertas = await ctx.db
      .query("sessions")
      .withIndex("by_estado_fecha", (q) =>
        q.eq("estado", "en_curso").lt("fecha", hoyMadrid),
      )
      .collect();

    const tzCache = new TzCache(ctx);
    let cerradas = 0;
    let pospuestas = 0;
    for (const s of abiertas) {
      if (!s.fecha) continue;
      const tz = await tzCache.get(s.pacienteId);
      if (!shouldCloseSession(s.fecha, tz)) {
        // Su día local aún no acabó (TZ por detrás de Madrid): mañana caerá.
        pospuestas += 1;
        continue;
      }
      await closeImpl(ctx, s._id, "cron_nocturno");
      cerradas += 1;
    }
    console.log(
      `[nightly-session-close] hoyMadrid=${hoyMadrid} cerradas=${cerradas}` +
        `/${abiertas.length} pospuestas=${pospuestas}`,
    );
    return { cerradas };
  },
});
