/**
 * Helpers para calcular planes activos y ejercicios esperados de un
 * paciente en una fecha concreta.
 *
 * Comparten lógica con `compliance/internal.ts` (legacy). Esta versión es
 * la canónica para el modelo nuevo (`sessions` rediseñada,
 * `dailyPatientRollup`, `exerciseUsageRollup`).
 */

import { Doc, Id } from "../_generated/dataModel";
import { GenericQueryCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import { DiaSemana } from "./datetime";

type DBCtx = GenericQueryCtx<DataModel>;

/** Plan vigente: fechaInicio <= target <= fechaFin (si están definidas). */
function isPlanVigente(plan: Doc<"plans">, target: string): boolean {
  if (plan.fechaInicio && plan.fechaInicio > target) return false;
  if (plan.fechaFin && plan.fechaFin < target) return false;
  return true;
}

/**
 * Devuelve los planes (`activo` o `completado`) vigentes para el paciente en
 * la fecha indicada. Un plan completado puede seguir teniendo registros de
 * actividad si la fecha cae dentro de su intervalo de vigencia.
 */
export async function getActivePlansForPatientOnDate(
  ctx: DBCtx,
  pacienteId: Id<"users">,
  target: string,
): Promise<Doc<"plans">[]> {
  const [activos, completados] = await Promise.all([
    ctx.db
      .query("plans")
      .withIndex("by_pacienteId_estado", (q) =>
        q.eq("pacienteId", pacienteId).eq("estado", "activo"),
      )
      .collect(),
    ctx.db
      .query("plans")
      .withIndex("by_pacienteId_estado", (q) =>
        q.eq("pacienteId", pacienteId).eq("estado", "completado"),
      )
      .collect(),
  ]);
  return [...activos, ...completados].filter((p) => isPlanVigente(p, target));
}

export interface ExpectedExerciseItem {
  planExerciseId: Id<"planExercises">;
  planId: Id<"plans">;
}

/**
 * Devuelve la lista expandida de ejercicios esperados para el paciente en
 * la fecha indicada (1 entrada por planExercise). Cada entrada cuenta
 * como una unidad de "completar" en el día.
 */
export async function getExpectedExercisesForPatientOnDate(
  ctx: DBCtx,
  pacienteId: Id<"users">,
  target: string,
  diaSemana: DiaSemana,
): Promise<ExpectedExerciseItem[]> {
  const planes = await getActivePlansForPatientOnDate(ctx, pacienteId, target);
  if (planes.length === 0) return [];

  const allItems = await Promise.all(
    planes.map((plan) =>
      ctx.db
        .query("planExercises")
        .withIndex("by_planId", (q) => q.eq("planId", plan._id))
        .collect(),
    ),
  );

  const out: ExpectedExerciseItem[] = [];
  for (let i = 0; i < planes.length; i++) {
    const plan = planes[i];
    for (const item of allItems[i]) {
      // Si no hay diasSemana definidos, el ejercicio aplica todos los días.
      if (
        item.diasSemana &&
        item.diasSemana.length > 0 &&
        !item.diasSemana.includes(diaSemana)
      ) {
        continue;
      }
      out.push({
        planExerciseId: item._id,
        planId: plan._id,
      });
    }
  }
  return out;
}

/**
 * Devuelve el clinicId del paciente (su primer membership). Devuelve null
 * si el paciente no tiene membership asignado.
 */
export async function getClinicIdForPatient(
  ctx: DBCtx,
  pacienteId: Id<"users">,
): Promise<Id<"clinics"> | null> {
  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", pacienteId))
    .first();
  return membership?.clinicId ?? null;
}

/**
 * Suma totales esperados (cuenta cada planExerciseId) y los agrupa por
 * plan. Útil para `sessions.totalEsperados` y para
 * `dailyPatientRollup.planAggregates`.
 */
export function sumExpectedByPlan(
  items: ExpectedExerciseItem[],
): {
  totalEsperados: number;
  porPlan: Map<Id<"plans">, number>;
} {
  const porPlan = new Map<Id<"plans">, number>();
  for (const it of items) {
    porPlan.set(it.planId, (porPlan.get(it.planId) ?? 0) + 1);
  }
  return { totalEsperados: items.length, porPlan };
}
