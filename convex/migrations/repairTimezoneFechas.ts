/**
 * Migración de reparación: re-fecha las `exerciseExecutions` (y sus sesiones)
 * que quedaron selladas con el día equivocado por el cálculo Madrid-céntrico
 * de fechas, usando la TZ real del usuario (`users.timezone`).
 *
 * Contexto: hasta el fix TZ, `fecha` se derivaba SIEMPRE en Europe/Madrid.
 * Un paciente canario que entrenaba entre 23:00 y 23:59 (hora local) quedaba
 * registrado en el día SIGUIENTE: su día real aparecía a cero (rollup
 * `fallido`, racha rota, adherencia baja, falsas alertas de inactividad).
 *
 * Detección: una execution está afectada ⇔
 *   `getCurrentDateInTz(tz, new Date(e.fechaHora)) !== e.fecha`
 * (`fechaHora` es el instante UTC real; solo puede diferir en ±1 día).
 *
 * Reparación por usuario (idempotente, guardada por `users.tzRepairDoneAt`):
 *  1. Agrupar afectadas por su `fechaCorrecta`.
 *  2. Mover cada grupo a la sesión de `(pacienteId, fechaCorrecta)` —
 *     reutilizando `openOrResumeImpl` (crea la sesión si no existe, con los
 *     esperados de ese día) y cerrándola después si procede.
 *  3. Refrescar denormalizados de las sesiones ORIGEN; borrar las que queden
 *     sin executions (sesiones fantasma creadas prematuramente de madrugada).
 *  4. `recomputeDayAndPropagateImpl` para cada fecha tocada (origen+destino).
 *  5. Encolar `snapshots.recomputePatient` + `recomputeClinic` (racha).
 *  6. Auditar en `dataRepairAudit` y marcar `tzRepairDoneAt`.
 *
 * La reparación se dispara automáticamente (una vez) desde
 * `users.syncTimezone` cuando el usuario sincroniza su primera TZ ≠ Madrid.
 * NO se repite en cambios de TZ posteriores: la historia con TZ mixta es
 * ambigua y se acepta tal cual.
 *
 * Orden operativo (batch manual para usuarios ya sincronizados):
 *   0) Backup:  npx convex export --path ./backups/kengo-prod-pre-tzrepair-<fecha>.zip
 *   1) Dry-run por usuario:
 *      npx convex run migrations/repairTimezoneFechas:dryRunUser '{"userId":"..."}'
 *   2) Barrido: npx convex run migrations/repairTimezoneFechas:runAll
 *   3) Drenar stale (repetir hasta procesados < batchSize):
 *      npx convex run rollups/internal:processStaleWeeklyRollups '{"batchSize":100}'
 *      npx convex run rollups/internal:processStaleMonthlyRollups '{"batchSize":100}'
 *   4) Validar:  npx convex run migrations/repairTimezoneFechas:validate
 */

import { v } from "convex/values";
import { FunctionReference } from "convex/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalQuery, MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation } from "../_helpers/mutationWithTriggers";
import {
  DEFAULT_TZ,
  getCurrentDateInTz,
  isValidIanaTimezone,
} from "../_helpers/datetime";
import { computeAggregatesFromExecutions } from "../_helpers/rollupComputation";
import { computeEstadoSesion } from "../_helpers/sessionCounting";
import { computeDayCountsForPatient } from "../_helpers/sessionCountingDb";
import { closeImpl, openOrResumeImpl } from "../sessions/internal";
import { recomputeDayAndPropagateImpl } from "../rollups/internal";

export const MIGRACION = "repairTimezoneFechas/2026-08";

// `_generated/api.d.ts` no incluye este módulo hasta el próximo codegen (que
// solo corre en deploy — nunca lanzar `npx convex codegen` suelto: hace push
// a producción). El proxy runtime de `internal` sí lo resuelve; este alias
// tipado evita el error de tipos sin regenerar antes de tiempo.
const selfInternal = (
  internal.migrations as Record<string, Record<string, unknown>>
)["repairTimezoneFechas"] as {
  repairForUser: FunctionReference<
    "mutation",
    "internal",
    { userId: Id<"users"> }
  >;
  validateUser: FunctionReference<"query", "internal">;
  listUsersWithForeignTz: FunctionReference<"query", "internal">;
};

/** Plan de reparación puro: agrupa las executions afectadas por fecha correcta. */
export function buildRepairPlan(
  tz: string,
  executions: Array<{ fecha: string; fechaHora: string }>,
): Map<string, number[]> {
  const grupos = new Map<string, number[]>();
  executions.forEach((e, idx) => {
    const fechaCorrecta = getCurrentDateInTz(tz, new Date(e.fechaHora));
    if (fechaCorrecta === e.fecha) return;
    const grupo = grupos.get(fechaCorrecta);
    if (grupo) grupo.push(idx);
    else grupos.set(fechaCorrecta, [idx]);
  });
  return grupos;
}

async function listExecutionsForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"exerciseExecutions">[]> {
  return await ctx.db
    .query("exerciseExecutions")
    .withIndex("by_pacienteId_fecha", (q) => q.eq("pacienteId", userId))
    .collect();
}

/**
 * Refresca los denormalizados de una sesión ORIGEN tras mover executions
 * (mismo criterio que `refreshSessionCounts` del runtime + re-deriva el
 * `estado` para sesiones ya cerradas, como `repairSessionsIntegrity`).
 * Si la sesión queda sin executions, la borra y devuelve `deleted: true`.
 */
async function refreshOrDeleteOriginSession(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
): Promise<{ deleted: boolean }> {
  const session = await ctx.db.get(sessionId);
  if (!session || !session.fecha) return { deleted: false };

  const executions = await ctx.db
    .query("exerciseExecutions")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .collect();

  if (executions.length === 0) {
    // Sesión fantasma: se creó de madrugada para el "día siguiente" Madrid y
    // todas sus executions pertenecían en realidad al día anterior local.
    await ctx.db.delete(sessionId);
    return { deleted: true };
  }

  const { counts, expected } = await computeDayCountsForPatient(ctx, {
    pacienteId: session.pacienteId,
    fecha: session.fecha,
    clinicId: session.clinicId,
    executions,
  });
  const agg = computeAggregatesFromExecutions(counts.dedupExecutions);
  const planIds = Array.from(new Set(expected.map((e) => e.planId)));
  const patch: Record<string, unknown> = {
    totalEsperados: counts.totalEsperados,
    totalCompletados: counts.totalCompletados,
    totalExtras: counts.totalExtras,
    planIds,
    duracionTotalSeg: agg.duracionTotalSeg,
    dolorMin: agg.dolorMin,
    dolorMax: agg.dolorMax,
    dolorPromedio: agg.dolorPromedio,
    esfuerzoPromedio: agg.esfuerzoPromedio,
  };
  if (session.estado !== "en_curso") {
    patch["estado"] = computeEstadoSesion(counts);
  }
  await ctx.db.patch(sessionId, patch);
  return { deleted: false };
}

interface RepairSummary {
  userId: Id<"users">;
  tz: string | null;
  skipped:
    | null
    | "sin_timezone"
    | "timezone_invalida"
    | "timezone_madrid"
    | "ya_reparado";
  totalExecutions: number;
  afectadas: number;
  gruposPorFecha: Record<string, number>;
  sesionesOrigenBorradas: number;
  fechasRecomputadas: string[];
}

export async function repairForUserImpl(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<RepairSummary> {
  const base: RepairSummary = {
    userId,
    tz: null,
    skipped: null,
    totalExecutions: 0,
    afectadas: 0,
    gruposPorFecha: {},
    sesionesOrigenBorradas: 0,
    fechasRecomputadas: [],
  };

  const user = await ctx.db.get(userId);
  const tz = user?.timezone;
  if (!tz) return { ...base, skipped: "sin_timezone" };
  base.tz = tz;
  if (!isValidIanaTimezone(tz)) return { ...base, skipped: "timezone_invalida" };
  if (user.tzRepairDoneAt !== undefined) {
    return { ...base, skipped: "ya_reparado" };
  }
  if (tz === DEFAULT_TZ) {
    // Nada que reparar; marcar done para no re-evaluar en cada sync.
    await ctx.db.patch(userId, { tzRepairDoneAt: Date.now() });
    return { ...base, skipped: "timezone_madrid" };
  }

  const executions = await listExecutionsForUser(ctx, userId);
  base.totalExecutions = executions.length;
  const grupos = buildRepairPlan(tz, executions);

  const fechasTocadas = new Set<string>();
  const clinicasTocadas = new Set<Id<"clinics">>();
  let sesionesOrigenBorradas = 0;

  for (const [fechaCorrecta, idxs] of grupos) {
    const movidas = idxs.map((i) => executions[i]);
    base.afectadas += movidas.length;
    base.gruposPorFecha[fechaCorrecta] = movidas.length;

    const clinicId = movidas[0].clinicId;
    const origenIds = new Set(movidas.map((e) => e.sessionId));

    // Sesión destino (se crea con los esperados de fechaCorrecta si no existe).
    const destSessionId = await openOrResumeImpl(
      ctx,
      userId,
      fechaCorrecta,
      clinicId,
    );

    // Mover las executions al día correcto. Los triggers de aggregates se
    // disparan vía `internalMutation` de mutationWithTriggers en el caller.
    for (const e of movidas) {
      await ctx.db.patch(e._id, {
        fecha: fechaCorrecta,
        sessionId: destSessionId,
      });
    }

    // Ajustar fechaInicio del destino al primer instante real del día y
    // cerrar la sesión si su día ya pasó en la TZ del paciente.
    const minFechaHora = movidas
      .map((e) => e.fechaHora)
      .reduce((a, b) => (a < b ? a : b));
    const dest = await ctx.db.get(destSessionId);
    if (dest && (!dest.fechaInicio || dest.fechaInicio > minFechaHora)) {
      await ctx.db.patch(destSessionId, { fechaInicio: minFechaHora });
    }
    if (fechaCorrecta < getCurrentDateInTz(tz)) {
      // closeImpl refresca los denormalizados con el conteo canónico y
      // decide completada vs completada_parcial.
      await closeImpl(ctx, destSessionId, "cron_nocturno");
    }

    // Sesiones origen: refrescar denormalizados o borrar si quedaron vacías.
    for (const origenId of origenIds) {
      if (origenId === destSessionId) continue;
      const origen = await ctx.db.get(origenId);
      const fechaOrigen = origen?.fecha;
      const { deleted } = await refreshOrDeleteOriginSession(ctx, origenId);
      if (deleted) sesionesOrigenBorradas += 1;
      if (fechaOrigen) fechasTocadas.add(fechaOrigen);
    }

    fechasTocadas.add(fechaCorrecta);
    clinicasTocadas.add(clinicId);

    // Auditoría por grupo (antes/después JSON, patrón repairSessionsIntegrity).
    await ctx.db.insert("dataRepairAudit", {
      migracion: MIGRACION,
      sessionId: destSessionId,
      pacienteId: userId,
      clinicId,
      fecha: fechaCorrecta,
      antes: JSON.stringify({
        tz,
        movidas: movidas.map((e) => ({
          executionId: e._id,
          fechaAnterior: e.fecha,
          fechaHora: e.fechaHora,
          sesionOrigen: e.sessionId,
        })),
      }),
      despues: JSON.stringify({
        fechaCorrecta,
        destSessionId,
        totalMovidas: movidas.length,
      }),
      createdAt: Date.now(),
    });
  }

  // Re-materializar rollups de todas las fechas tocadas (marca weekly/monthly
  // stale; drenar con processStale*Rollups según el runbook).
  const fechas = Array.from(fechasTocadas).sort();
  for (const fecha of fechas) {
    await recomputeDayAndPropagateImpl(ctx, userId, fecha);
  }
  base.fechasRecomputadas = fechas;
  base.sesionesOrigenBorradas = sesionesOrigenBorradas;

  // Rachas y métricas de clínica (async, fuera de esta transacción).
  if (fechas.length > 0) {
    await ctx.scheduler.runAfter(0, internal.snapshots.internal.recomputePatient, {
      pacienteId: userId,
    });
    for (const clinicId of clinicasTocadas) {
      await ctx.scheduler.runAfter(0, internal.snapshots.internal.recomputeClinic, {
        clinicId,
      });
    }
  }

  await ctx.db.patch(userId, { tzRepairDoneAt: Date.now() });
  console.log(
    `[repairTimezoneFechas] user=${userId} tz=${tz} afectadas=${base.afectadas} ` +
      `grupos=${grupos.size} borradas=${sesionesOrigenBorradas}`,
  );
  return base;
}

/** Reparación de un usuario. Programada desde `users.syncTimezone` (una vez). */
export const repairForUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<RepairSummary> => {
    return await repairForUserImpl(ctx, args.userId);
  },
});

/**
 * Dry-run por usuario: qué se movería, sin escribir nada.
 */
export const dryRunUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    const tz = user?.timezone;
    if (!tz || !isValidIanaTimezone(tz) || tz === DEFAULT_TZ) {
      return { tz: tz ?? null, aplicable: false, afectadas: 0, grupos: {} };
    }
    const executions = await listExecutionsForUser(ctx, args.userId);
    const grupos = buildRepairPlan(tz, executions);
    const detalle: Record<
      string,
      Array<{ executionId: string; fechaAnterior: string; fechaHora: string }>
    > = {};
    for (const [fechaCorrecta, idxs] of grupos) {
      detalle[fechaCorrecta] = idxs.map((i) => ({
        executionId: String(executions[i]._id),
        fechaAnterior: executions[i].fecha,
        fechaHora: executions[i].fechaHora,
      }));
    }
    return {
      tz,
      aplicable: user.tzRepairDoneAt === undefined,
      totalExecutions: executions.length,
      afectadas: Object.values(detalle).reduce((a, b) => a + b.length, 0),
      grupos: detalle,
    };
  },
});

/**
 * Barrido batch: repara todos los usuarios con TZ ≠ Madrid pendientes.
 * Encola un `repairForUser` por usuario (transacciones independientes).
 */
export const runAll = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ encolados: number }> => {
    const users = await ctx.db.query("users").collect();
    let encolados = 0;
    for (const user of users) {
      const tz = user.timezone;
      if (!tz || !isValidIanaTimezone(tz) || tz === DEFAULT_TZ) continue;
      if (user.tzRepairDoneAt !== undefined) continue;
      await ctx.scheduler.runAfter(encolados * 100, selfInternal.repairForUser, {
        userId: user._id,
      });
      encolados += 1;
    }
    console.log(`[repairTimezoneFechas:runAll] encolados=${encolados}`);
    return { encolados };
  },
});

/**
 * Validación por usuario: 0 executions con `fecha` ≠ día(`fechaHora`, tz).
 */
export const validateUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<{ tz: string | null; total: number; incoherentes: number }> => {
    const user = await ctx.db.get(args.userId);
    const tz = user?.timezone;
    if (!tz || !isValidIanaTimezone(tz)) {
      return { tz: tz ?? null, total: 0, incoherentes: 0 };
    }
    const executions = await listExecutionsForUser(ctx, args.userId);
    const grupos = buildRepairPlan(tz, executions);
    let incoherentes = 0;
    for (const idxs of grupos.values()) incoherentes += idxs.length;
    return { tz, total: executions.length, incoherentes };
  },
});

/**
 * Validación global: suma incoherencias de todos los usuarios con TZ ≠ Madrid.
 */
export const validate = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ usuarios: number; incoherentes: number }> => {
    const userIds: Id<"users">[] = await ctx.runQuery(
      selfInternal.listUsersWithForeignTz,
      {},
    );
    let incoherentes = 0;
    for (const userId of userIds) {
      const res: { incoherentes: number } = await ctx.runQuery(
        selfInternal.validateUser,
        { userId },
      );
      incoherentes += res.incoherentes;
    }
    console.log(
      `[repairTimezoneFechas:validate] usuarios=${userIds.length} incoherentes=${incoherentes}`,
    );
    return { usuarios: userIds.length, incoherentes };
  },
});

export const listUsersWithForeignTz = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"users">[]> => {
    const users = await ctx.db.query("users").collect();
    return users
      .filter(
        (u) =>
          u.timezone &&
          isValidIanaTimezone(u.timezone) &&
          u.timezone !== DEFAULT_TZ,
      )
      .map((u) => u._id);
  },
});
