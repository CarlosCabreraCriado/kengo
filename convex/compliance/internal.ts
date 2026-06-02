/**
 * Mantenimiento diario consolidado. Punto de entrada del cron diario
 * (`crons.ts:daily-maintenance` a las 03:00 UTC).
 *
 * Tras Fase 5 (drop legacy), este archivo solo contiene la mutation del cron;
 * las funciones legacy de cumplimiento (`processCompliance`,
 * `recalculateClinicMetrics`, `calculateDailyCompliance`) se eliminaron.
 *
 * Tareas activas:
 *  - Expirar planes vencidos.
 *  - Procesar rollups stale (semanales y mensuales).
 *  - Recompute snapshots (paciente + clínica).
 *  - Recompute exerciseUsageRollup del mes en curso.
 *  - Reglas diarias de alertas (Fase 4).
 */

import { internalMutation } from "../_helpers/mutationWithTriggers";
import { internal } from "../_generated/api";
import { expireOverduePlansImpl } from "../plans/internal";

interface DailyMaintenanceResult {
  expired: number;
  weekly: number;
  monthly: number;
  patientsSnap: number;
  clinicsSnap: number;
  usage: number;
  alertas: number;
}

export const dailyMaintenance = internalMutation({
  args: {},
  handler: async (ctx): Promise<DailyMaintenanceResult> => {
    const expired = await expireOverduePlansImpl(ctx);

    // El cron `nightly-session-close` (02:00 UTC) ya cerró las sesiones del
    // día anterior. Aquí procesamos sus consecuencias.
    const weeklyRes = await ctx.runMutation(
      internal.rollups.internal.processStaleWeeklyRollups,
      {},
    );
    const monthlyRes = await ctx.runMutation(
      internal.rollups.internal.processStaleMonthlyRollups,
      {},
    );
    const patientsRes = await ctx.runMutation(
      internal.snapshots.internal.recomputeAllPatients,
      {},
    );
    const clinicsSnapRes = await ctx.runMutation(
      internal.snapshots.internal.recomputeAllClinics,
      {},
    );
    const usageRes = await ctx.runMutation(
      internal.snapshots.internal.recomputeExerciseUsage,
      {},
    );
    const alertasRes = await ctx.runMutation(
      internal.alerts.internal.runDailyAlertRules,
      {},
    );

    console.log(
      `[maintenance] expirados=${expired} weekly=${weeklyRes.procesados} monthly=${monthlyRes.procesados} patientsSnap=${patientsRes.procesados} clinicsSnap=${clinicsSnapRes.procesados} usage=${usageRes.procesados} alertas=${alertasRes.generadas}`,
    );
    return {
      expired,
      weekly: weeklyRes.procesados,
      monthly: monthlyRes.procesados,
      patientsSnap: patientsRes.procesados,
      clinicsSnap: clinicsSnapRes.procesados,
      usage: usageRes.procesados,
      alertas: alertasRes.generadas,
    };
  },
});
