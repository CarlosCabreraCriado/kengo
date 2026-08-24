/**
 * Mantenimiento diario. Punto de entrada del cron diario
 * (`crons.ts:daily-maintenance` a las 03:00 UTC).
 *
 * Tras Fase 5 (drop legacy), este archivo solo contiene las mutations del
 * cron; las funciones legacy de cumplimiento (`processCompliance`,
 * `recalculateClinicMetrics`, `calculateDailyCompliance`) se eliminaron.
 *
 * Pasos (en este orden):
 *  - Expirar planes vencidos.
 *  - Sincronizar `patientsWithActivePlanByClinic` con `isPlanEnCurso`.
 *  - Procesar rollups stale (semanales y mensuales).
 *  - Recompute snapshots (paciente + clínica).
 *  - Recompute exerciseUsageRollup del mes en curso.
 *  - Reglas diarias de alertas (Fase 4).
 *
 * Arquitectura: cada paso corre en su PROPIA transacción, encadenada con
 * `ctx.scheduler.runAfter(0, runMaintenanceStep, { step: n+1 })`. Antes
 * todos los pasos se ejecutaban dentro de una única mutation vía
 * `ctx.runMutation`, y cualquier fallo de un paso (límite de lecturas /
 * escrituras por transacción, tiempo de ejecución, conflicto OCC) hacía
 * rollback de TODO el mantenimiento — incluido el sweep del aggregate — de
 * forma silenciosa. Consecuencia observada en producción: pacientes con plan
 * "empieza mañana" nunca entraban en el aggregate, el cron de materialización
 * no les creaba días `fallido` y su adherencia quedaba clavada en 100 %.
 *
 * Reglas del encadenado:
 *  - Un paso puede devolver `cursor` para pedir que se le vuelva a invocar
 *    (batching por cursor). Los pasos pesados paginan internamente.
 *  - Si un paso lanza, se registra con `console.error` y se continúa con el
 *    siguiente: un fallo aislado ya no bloquea al resto.
 *  - `ctx.runMutation` ejecuta el paso como sub-transacción: si lanza, sus
 *    escrituras se descartan y el orquestador (que casi no lee) sobrevive
 *    para programar el siguiente paso.
 */

import { v } from "convex/values";
import { internalMutation } from "../_helpers/mutationWithTriggers";
import { internal } from "../_generated/api";
import { MutationCtx } from "../_generated/server";

const STEPS = [
  "expirePlans",
  "syncActivePatients",
  "weeklyRollups",
  "monthlyRollups",
  "patientSnapshots",
  "clinicSnapshots",
  "exerciseUsage",
  "alerts",
] as const;

type Step = (typeof STEPS)[number];

/** Resultado común de cada paso: `cursor` presente ⇒ quedan lotes. */
export interface MaintenanceStepResult {
  procesados: number;
  cursor?: string;
}

/**
 * Salvaguarda contra bucles: nº máximo de lotes por paso en una misma
 * ejecución del mantenimiento. Muy por encima de lo que necesita cualquier
 * paso real (≈ 100 pares por lote).
 */
const MAX_BATCHES_PER_STEP = 500;

export const dailyMaintenance = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    console.log(`[maintenance] inicio (${STEPS.length} pasos)`);
    await ctx.scheduler.runAfter(
      0,
      internal.compliance.internal.runMaintenanceStep,
      { step: 0 },
    );
  },
});

export const runMaintenanceStep = internalMutation({
  args: {
    step: v.number(),
    cursor: v.optional(v.string()),
    batch: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const name = STEPS[args.step];
    if (!name) {
      console.log("[maintenance] fin");
      return;
    }
    const batch = args.batch ?? 0;

    let next: string | undefined;
    try {
      const res = await runStep(ctx, name, args.cursor);
      next = res.cursor;
      console.log(
        `[maintenance:${name}] lote=${batch} procesados=${res.procesados}` +
          (next ? " (continúa)" : ""),
      );
    } catch (err) {
      console.error(
        `[maintenance:${name}] lote=${batch} ERROR — se continúa con el siguiente paso`,
        err,
      );
    }

    if (next && batch + 1 >= MAX_BATCHES_PER_STEP) {
      console.error(
        `[maintenance:${name}] alcanzado MAX_BATCHES_PER_STEP=${MAX_BATCHES_PER_STEP}; se aborta el paso`,
      );
      next = undefined;
    }

    if (next) {
      await ctx.scheduler.runAfter(
        0,
        internal.compliance.internal.runMaintenanceStep,
        { step: args.step, cursor: next, batch: batch + 1 },
      );
      return;
    }
    await ctx.scheduler.runAfter(
      0,
      internal.compliance.internal.runMaintenanceStep,
      { step: args.step + 1 },
    );
  },
});

async function runStep(
  ctx: MutationCtx,
  step: Step,
  cursor: string | undefined,
): Promise<MaintenanceStepResult> {
  switch (step) {
    case "expirePlans":
      return await ctx.runMutation(internal.plans.internal.expireOverduePlans, {
        cursor,
      });
    case "syncActivePatients":
      return await ctx.runMutation(
        internal.snapshots.internal.syncActivePatientsAllClinics,
        { cursor },
      );
    case "weeklyRollups":
      return await ctx.runMutation(
        internal.rollups.internal.processStaleWeeklyRollups,
        {},
      );
    case "monthlyRollups":
      return await ctx.runMutation(
        internal.rollups.internal.processStaleMonthlyRollups,
        {},
      );
    case "patientSnapshots":
      return await ctx.runMutation(
        internal.snapshots.internal.recomputeAllPatients,
        { cursor },
      );
    case "clinicSnapshots":
      return await ctx.runMutation(
        internal.snapshots.internal.recomputeAllClinics,
        {},
      );
    case "exerciseUsage":
      return await ctx.runMutation(
        internal.snapshots.internal.recomputeExerciseUsage,
        { cursor },
      );
    case "alerts": {
      const res = await ctx.runMutation(
        internal.alerts.internal.runDailyAlertRules,
        {},
      );
      return { procesados: res.generadas };
    }
  }
}
