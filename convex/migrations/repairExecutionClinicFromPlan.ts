/**
 * Migración de reparación: re-atribuye a la clínica de su PLAN las
 * `exerciseExecutions` (y sus sesiones y alertas) que quedaron etiquetadas
 * con otra clínica.
 *
 * Contexto (auditoría 2026-10-01 sobre producción): un paciente multiclínica
 * registraba ejecuciones de planes de la clínica B con el `clinicId` de su
 * PRIMERA membresía (A), porque `executions.createBatch` derivaba la clínica
 * con `getClinicIdForPatient` (`.first()` por userId). Resultado: 33
 * ejecuciones de planes de MYO atribuidas a "Kengo". La clínica dueña del
 * plan no veía la adherencia y la otra veía datos ajenos. El runtime ya
 * deriva la clínica del plan; esta migración arregla el histórico.
 *
 * Reglas, por sesión afectada:
 * - Cada ejecución desalineada pasa a la sesión de su clínica correcta para
 *   ese (paciente, fecha). Si la sesión entera es de otra clínica (todas sus
 *   ejecuciones desalineadas hacia la misma) y no hay ya una sesión de esa
 *   clínica ese día, se re-etiqueta la sesión en vez de crear otra.
 * - Si hace falta una sesión nueva, copia estado/fechas/motivo de la origen.
 * - Las alertas ligadas a las ejecuciones movidas (y, si la sesión se
 *   re-etiqueta, las ligadas a la sesión) pasan a la clínica correcta.
 * - Se recomputan los denormalizados de las sesiones tocadas y el rollup
 *   diario del día (que marca stale semanal/mensual).
 * - Cada sesión reparada deja una fila en `dataRepairAudit`.
 *
 * Orden operativo:
 *   0) Backup:  npx convex export --path ./backups/kengo-prod-pre-repair-<fecha>.zip
 *   1) Dry-run: npx convex run migrations/repairExecutionClinicFromPlan:dryRun
 *   2) Aplicar: npx convex run migrations/repairExecutionClinicFromPlan:run
 *   3) Drenar stale (repetir hasta procesados < batchSize):
 *      npx convex run rollups/internal:processStaleWeeklyRollups '{"batchSize":100}'
 *      npx convex run rollups/internal:processStaleMonthlyRollups '{"batchSize":100}'
 *   4) Snapshots:
 *      npx convex run snapshots/internal:recomputeAllPatients
 *      npx convex run snapshots/internal:recomputeAllClinics
 *   5) Validar: el dry-run debe devolver `ejecuciones: 0`.
 */

import { v } from "convex/values";
import { FunctionReference } from "convex/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalQuery } from "../_generated/server";
import { internalMutation } from "../_helpers/mutationWithTriggers";
import { refreshSessionCounts } from "../sessions/internal";
import { recomputeDayAndPropagateImpl } from "../rollups/internal";

// `_generated/api.d.ts` no incluye este módulo hasta el próximo deploy (no
// lanzar `npx convex codegen` suelto: hace push a producción). El proxy
// runtime de `internal` sí lo resuelve; este alias tipado evita el error.
const selfInternal = (
  internal.migrations as Record<string, Record<string, unknown>>
)["repairExecutionClinicFromPlan"] as {
  findMismatchesPage: FunctionReference<"query", "internal">;
  repairSession: FunctionReference<"mutation", "internal">;
};

export const MIGRACION = "repairExecutionClinicFromPlan/2026-10";

interface Mismatch {
  executionId: Id<"exerciseExecutions">;
  sessionId: Id<"sessions">;
  pacienteId: Id<"users">;
  fecha: string;
  clinicIdActual: Id<"clinics">;
  clinicIdPlan: Id<"clinics">;
}

/** Página de ejecuciones cuyo `clinicId` no coincide con el de su plan. */
export const findMismatchesPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ mismatches: Mismatch[]; isDone: boolean; continueCursor: string }> => {
    const page = await ctx.db
      .query("exerciseExecutions")
      .paginate({ cursor: args.cursor, numItems: args.numItems });

    const planClinic = new Map<Id<"plans">, Id<"clinics"> | null>();
    const mismatches: Mismatch[] = [];
    for (const e of page.page) {
      if (!planClinic.has(e.planId)) {
        const plan = await ctx.db.get(e.planId);
        planClinic.set(e.planId, plan?.clinicId ?? null);
      }
      const clinicIdPlan = planClinic.get(e.planId);
      // Planes legados sin clinicId: no hay verdad contra la que comparar.
      if (!clinicIdPlan || clinicIdPlan === e.clinicId) continue;
      mismatches.push({
        executionId: e._id,
        sessionId: e.sessionId,
        pacienteId: e.pacienteId,
        fecha: e.fecha,
        clinicIdActual: e.clinicId,
        clinicIdPlan,
      });
    }
    return {
      mismatches,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

async function collectMismatches(
  ctx: { runQuery: (ref: FunctionReference<"query", "internal">, args: Record<string, unknown>) => Promise<unknown> },
): Promise<Mismatch[]> {
  const all: Mismatch[] = [];
  let cursor: string | null = null;
  for (;;) {
    const res = (await ctx.runQuery(selfInternal.findMismatchesPage, {
      cursor,
      numItems: 500,
    })) as { mismatches: Mismatch[]; isDone: boolean; continueCursor: string };
    all.push(...res.mismatches);
    if (res.isDone) break;
    cursor = res.continueCursor;
  }
  return all;
}

function resumen(mismatches: Mismatch[]) {
  const porPaciente: Record<string, number> = {};
  const porTransicion: Record<string, number> = {};
  for (const m of mismatches) {
    porPaciente[m.pacienteId] = (porPaciente[m.pacienteId] ?? 0) + 1;
    const k = `${m.clinicIdActual} -> ${m.clinicIdPlan}`;
    porTransicion[k] = (porTransicion[k] ?? 0) + 1;
  }
  return {
    ejecuciones: mismatches.length,
    sesiones: new Set(mismatches.map((m) => m.sessionId)).size,
    porPaciente,
    porTransicion,
  };
}

/** Solo lectura: cuántas ejecuciones/sesiones se repararían. */
export const dryRun = internalAction({
  args: {},
  handler: async (ctx) => resumen(await collectMismatches(ctx)),
});

/**
 * Repara una sesión: mueve sus ejecuciones desalineadas a la sesión de la
 * clínica de su plan. Idempotente: una segunda pasada no encuentra nada.
 */
export const repairSession = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args): Promise<{ movidas: number; reetiquetada: boolean }> => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return { movidas: 0, reetiquetada: false };

    const executions = await ctx.db
      .query("exerciseExecutions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect();

    // Clínica correcta de cada ejecución (la de su plan).
    const planClinic = new Map<Id<"plans">, Id<"clinics"> | null>();
    const destino = new Map<Id<"exerciseExecutions">, Id<"clinics">>();
    for (const e of executions) {
      if (!planClinic.has(e.planId)) {
        const plan = await ctx.db.get(e.planId);
        planClinic.set(e.planId, plan?.clinicId ?? null);
      }
      const c = planClinic.get(e.planId);
      if (c && c !== e.clinicId) destino.set(e._id, c);
    }
    if (destino.size === 0) return { movidas: 0, reetiquetada: false };

    const delDia = await ctx.db
      .query("sessions")
      .withIndex("by_pacienteId_fecha", (q) =>
        q.eq("pacienteId", session.pacienteId).eq("fecha", session.fecha),
      )
      .collect();

    const clinicasDestino = new Set(destino.values());
    const todasSeVan = destino.size === executions.length;
    const unicaDestino =
      clinicasDestino.size === 1 ? [...clinicasDestino][0] : null;

    // Caso simple: la sesión entera es de otra clínica → re-etiquetarla.
    const reetiquetar =
      todasSeVan &&
      unicaDestino !== null &&
      !delDia.some((s) => s._id !== session._id && s.clinicId === unicaDestino);

    const antes = { clinicId: session.clinicId, ejecuciones: executions.length };
    const sesionesTocadas = new Set<Id<"sessions">>([session._id]);

    if (reetiquetar && unicaDestino) {
      await ctx.db.patch(session._id, { clinicId: unicaDestino });
      for (const e of executions) {
        await ctx.db.patch(e._id, { clinicId: unicaDestino });
      }
      const alertas = await alertasDePaciente(ctx, session.pacienteId);
      for (const a of alertas) {
        if (a.sessionId === session._id && a.clinicId !== unicaDestino) {
          await ctx.db.patch(a._id, { clinicId: unicaDestino });
        }
      }
    } else {
      const sesionPorClinica = new Map<Id<"clinics">, Id<"sessions">>();
      for (const s of delDia) {
        if (s._id !== session._id) sesionPorClinica.set(s.clinicId, s._id);
      }
      const alertas = await alertasDePaciente(ctx, session.pacienteId);
      for (const [executionId, clinicId] of destino) {
        let targetSessionId = sesionPorClinica.get(clinicId);
        if (!targetSessionId) {
          targetSessionId = await ctx.db.insert("sessions", {
            pacienteId: session.pacienteId,
            clinicId,
            fecha: session.fecha,
            fechaInicio: session.fechaInicio,
            fechaFin: session.fechaFin,
            estado: session.estado,
            motivoCierre: session.motivoCierre,
            planIds: [],
            totalEsperados: 0,
            totalCompletados: 0,
          });
          sesionPorClinica.set(clinicId, targetSessionId);
        }
        sesionesTocadas.add(targetSessionId);
        await ctx.db.patch(executionId, { clinicId, sessionId: targetSessionId });
        for (const a of alertas) {
          if (a.exerciseExecutionId === executionId) {
            await ctx.db.patch(a._id, { clinicId, sessionId: targetSessionId });
          }
        }
      }
    }

    for (const sessionId of sesionesTocadas) {
      const s = await ctx.db.get(sessionId);
      if (s) await refreshSessionCounts(ctx, s);
    }
    await recomputeDayAndPropagateImpl(ctx, session.pacienteId, session.fecha);

    await ctx.db.insert("dataRepairAudit", {
      migracion: MIGRACION,
      sessionId: session._id,
      pacienteId: session.pacienteId,
      clinicId: session.clinicId,
      fecha: session.fecha,
      antes: JSON.stringify(antes),
      despues: JSON.stringify({
        reetiquetada: reetiquetar,
        movidas: [...destino].map(([id, c]) => ({ id, clinicId: c })),
        sesiones: [...sesionesTocadas],
      }),
      createdAt: Date.now(),
    });

    return { movidas: destino.size, reetiquetada: reetiquetar };
  },
});

async function alertasDePaciente(
  ctx: { db: { query: (t: "physioAlerts") => any } },
  pacienteId: Id<"users">,
): Promise<Doc<"physioAlerts">[]> {
  return await ctx.db
    .query("physioAlerts")
    .withIndex("by_pacienteId_estado", (q: any) => q.eq("pacienteId", pacienteId))
    .collect();
}

/** Aplica la reparación a todas las sesiones afectadas. */
export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const mismatches = await collectMismatches(ctx);
    const sesiones = [...new Set(mismatches.map((m) => m.sessionId))];
    let movidas = 0;
    let reetiquetadas = 0;
    for (const sessionId of sesiones) {
      const r = (await ctx.runMutation(selfInternal.repairSession, {
        sessionId,
      })) as { movidas: number; reetiquetada: boolean };
      movidas += r.movidas;
      if (r.reetiquetada) reetiquetadas += 1;
    }
    return { sesiones: sesiones.length, movidas, reetiquetadas };
  },
});
