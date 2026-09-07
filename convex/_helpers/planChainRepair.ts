/**
 * Reparación de cadenas de versiones de planes.
 *
 * `plans.mutations.version` enlaza un plan viejo (`estado="modificado"`,
 * `planSucesor=nuevo`) con su versión nueva (`planAnterior=viejo`). Si la
 * versión nueva desaparece (hard-delete) o se cancela, el plan viejo queda
 * "huérfano": sigue `modificado` (oculto en todos los listados, no editable,
 * no borrable) y apunta a un sucesor que ya no rige. El paciente parece no
 * tener planes aunque los tuvo.
 *
 * Este módulo concentra la regla de restauración para que la usen:
 *   - `plans.mutations.remove` (al borrar/cancelar una versión sucesora).
 *   - `plans.internal.repairBrokenPlanChains` (paso nocturno de mantenimiento).
 *   - `migrations/repairOrphanPlanVersions` (reparación manual con dry-run).
 *
 * Las funciones `classifyChain` y `computeRestoredPredecessorPatch` son
 * puras (testeables en `planChainRepair.test.ts`); el resto toca la BD.
 */

import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { addDaysToYMD } from "./datetime";
import { _syncPatientActiveStateInClinic } from "../snapshots/internal";
import { recomputeAggregatesAndCheckAutoCloseImpl } from "../sessions/internal";

type AnyCtx = QueryCtx | MutationCtx;

export type MotivoCadenaRota =
  | "sin_sucesor"
  | "sucesor_inexistente"
  | "sucesor_cancelado";

/**
 * Clasifica el estado de la cadena de un plan `modificado`. Devuelve `null`
 * cuando la cadena está sana (o el plan no es una versión histórica).
 */
export function classifyChain(
  pred: Pick<Doc<"plans">, "estado" | "planSucesor">,
  sucesor: Pick<Doc<"plans">, "estado"> | null,
): MotivoCadenaRota | null {
  if (pred.estado !== "modificado") return null;
  if (!pred.planSucesor) return "sin_sucesor";
  if (!sucesor) return "sucesor_inexistente";
  if (sucesor.estado === "cancelado") return "sucesor_cancelado";
  return null;
}

export interface RestorePatch {
  estado: "activo" | "completado";
  /** `undefined` ⇒ Convex elimina el campo (el plan no tenía fechaFin). */
  fechaFin: string | undefined;
  planSucesor: undefined;
  fechaFinPreVersion: undefined;
}

/**
 * Patch que devuelve un predecesor `modificado` a su vigencia previa al
 * versionado. `today` en la TZ del paciente.
 *
 *  - `fechaFin`: la registrada en `fechaFinPreVersion` si existe (`null` ⇒
 *    el plan no tenía fin); si el campo está ausente (versionado legacy) se
 *    conserva la fechaFin truncada — no inventamos vigencia.
 *  - `estado`: `activo` si el plan sigue vigente hoy (sin fin o fin ≥ hoy),
 *    `completado` si ya terminó. Nunca `borrador`/`cancelado`: un plan solo
 *    se versiona cuando ya tiene actividad, así que estaba activo.
 */
export function computeRestoredPredecessorPatch(
  pred: Pick<
    Doc<"plans">,
    "fechaInicio" | "fechaFin" | "fechaFinPreVersion"
  >,
  today: string,
): RestorePatch {
  let fechaFin: string | undefined;
  if (pred.fechaFinPreVersion === undefined) {
    fechaFin = pred.fechaFin;
  } else if (pred.fechaFinPreVersion === null) {
    fechaFin = undefined;
  } else {
    fechaFin = pred.fechaFinPreVersion;
  }
  // Defensivo: nunca dejar un intervalo invertido.
  if (fechaFin && pred.fechaInicio && fechaFin < pred.fechaInicio) {
    fechaFin = pred.fechaInicio;
  }
  const estado: RestorePatch["estado"] =
    !fechaFin || fechaFin >= today ? "activo" : "completado";
  return {
    estado,
    fechaFin,
    planSucesor: undefined,
    fechaFinPreVersion: undefined,
  };
}

/**
 * Busca un "heredero" del sucesor desaparecido: un plan del mismo paciente
 * cuyo `planAnterior` apunta a él (cadena p1→p2→p3 donde p2 se borró fuera
 * de la app). Si existe, la cadena se repara re-enlazando p1→p3 en vez de
 * restaurar p1. No hay índice por `planAnterior`; el volumen de planes por
 * paciente es de decenas, así que `by_pacienteId` basta.
 */
export async function findHeir(
  ctx: AnyCtx,
  pacienteId: Id<"users">,
  missingSucesorId: Id<"plans">,
): Promise<Doc<"plans"> | null> {
  const planes = await ctx.db
    .query("plans")
    .withIndex("by_pacienteId", (q) => q.eq("pacienteId", pacienteId))
    .collect();
  return (
    planes.find(
      (p) => p.planAnterior === missingSucesorId && p.estado !== "cancelado",
    ) ?? null
  );
}

export interface RepairOutcome {
  planId: Id<"plans">;
  pacienteId: Id<"users">;
  clinicId: Id<"clinics">;
  motivo: MotivoCadenaRota;
  accion: "restaurado" | "relinkeado";
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
}

function snapshotPlan(p: Doc<"plans">): Record<string, unknown> {
  return {
    estado: p.estado,
    fechaInicio: p.fechaInicio ?? null,
    fechaFin: p.fechaFin ?? null,
    planSucesor: p.planSucesor ?? null,
    fechaFinPreVersion: p.fechaFinPreVersion,
  };
}

/**
 * Repara una cadena rota. Con `apply=false` solo calcula (dry-run). Con
 * `apply=true` escribe el patch y una fila en `dataRepairAudit` (upsert
 * idempotente por `(migracion, planId)`, conservando el `antes` de la primera
 * pasada). NO sincroniza aggregates ni recomputa rollups: el caller debe
 * invocar `afterPlanChainChange` después.
 */
export async function repairBrokenChain(
  ctx: MutationCtx,
  pred: Doc<"plans">,
  opts: {
    today: string;
    motivo: MotivoCadenaRota;
    apply: boolean;
    migracion: string;
  },
): Promise<RepairOutcome> {
  const antes = snapshotPlan(pred);
  const heir =
    opts.motivo === "sucesor_inexistente" && pred.planSucesor
      ? await findHeir(ctx, pred.pacienteId, pred.planSucesor)
      : null;

  let accion: RepairOutcome["accion"];
  let despues: Record<string, unknown>;

  if (heir) {
    accion = "relinkeado";
    despues = { ...antes, planSucesor: heir._id };
    if (opts.apply) {
      await ctx.db.patch(pred._id, { planSucesor: heir._id });
      await ctx.db.patch(heir._id, { planAnterior: pred._id });
    }
  } else {
    accion = "restaurado";
    const patch = computeRestoredPredecessorPatch(pred, opts.today);
    despues = {
      ...antes,
      estado: patch.estado,
      fechaFin: patch.fechaFin ?? null,
      planSucesor: null,
      fechaFinPreVersion: undefined,
    };
    if (opts.apply) {
      await ctx.db.patch(pred._id, patch);
    }
  }

  if (opts.apply) {
    const existing = await ctx.db
      .query("dataRepairAudit")
      .withIndex("by_migracion_planId", (q) =>
        q.eq("migracion", opts.migracion).eq("planId", pred._id),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        despues: JSON.stringify(despues),
      });
    } else {
      await ctx.db.insert("dataRepairAudit", {
        migracion: opts.migracion,
        planId: pred._id,
        pacienteId: pred.pacienteId,
        clinicId: pred.clinicId,
        fecha: opts.today,
        antes: JSON.stringify(antes),
        despues: JSON.stringify(despues),
        createdAt: Date.now(),
      });
    }
  }

  return {
    planId: pred._id,
    pacienteId: pred.pacienteId,
    clinicId: pred.clinicId,
    motivo: opts.motivo,
    accion,
    antes,
    despues,
  };
}

/** Días hacia atrás que merece la pena recomputar (alineado con la ventana
 * máxima de reconstrucción virtual de rollups). */
const MAX_RECOMPUTE_DAYS = 62;

/**
 * Efectos derivados tras cambiar `estado`/fechas de un plan o su cadena de
 * versiones:
 *   1. Sincroniza `patientsWithActivePlanByClinic`.
 *   2. Refresca HOY: la sesión abierta del día (que recomputa el rollup) o,
 *      si no hay sesión, el rollup directamente. Nota: si lo ya ejecutado hoy
 *      satisface el plan vigente, el recompute puede auto-cerrar la sesión
 *      como completada — es la semántica correcta.
 *   3. Si `recomputeDesde` llega, encola el recompute de los días pasados
 *      `[max(recomputeDesde, hoy-62), ayer]` en lotes (`recomputePlanRange`):
 *      los rollups de los días en que la versión sucesora estuvo vigente se
 *      calcularon con sus esperados y deben regenerarse contra el plan
 *      restaurado.
 */
export async function afterPlanChainChange(
  ctx: MutationCtx,
  args: {
    pacienteId: Id<"users">;
    clinicId: Id<"clinics">;
    today: string;
    recomputeDesde?: string;
  },
): Promise<void> {
  await _syncPatientActiveStateInClinic(ctx, args.pacienteId, args.clinicId);

  const sesionHoy = await ctx.db
    .query("sessions")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", args.pacienteId).eq("fecha", args.today),
    )
    .first();
  if (sesionHoy) {
    await recomputeAggregatesAndCheckAutoCloseImpl(ctx, sesionHoy._id);
  } else {
    await ctx.runMutation(internal.rollups.internal.recomputeDayAndPropagate, {
      pacienteId: args.pacienteId,
      fecha: args.today,
    });
  }

  if (args.recomputeDesde) {
    const suelo = addDaysToYMD(args.today, -MAX_RECOMPUTE_DAYS);
    const desde =
      args.recomputeDesde > suelo ? args.recomputeDesde : suelo;
    const hasta = addDaysToYMD(args.today, -1);
    if (desde <= hasta) {
      await ctx.scheduler.runAfter(
        0,
        internal.plans.internal.recomputePlanRange,
        { pacienteId: args.pacienteId, desde, hasta },
      );
    }
  }
}
