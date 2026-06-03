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
  activeSync: number;
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

    // Sweep que reevalúa `patientsWithActivePlanByClinic` con `isPlanEnCurso`
    // según la fecha actual: cubre planes con `fechaInicio` futura que entran
    // en curso al amanecer (las mutations de `plans` no pueden anticiparse al
    // cambio de día). Debe ir DESPUÉS de `expireOverduePlansImpl` (que ya
    // procesó las salidas por `fechaFin`) y ANTES de `recomputeAllClinics`
    // (que leerá el aggregate fresco para `pacientesActivos`).
    const activeSyncRes = await ctx.runMutation(
      internal.snapshots.internal.syncActivePatientsAllClinics,
      {},
    );

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
      `[maintenance] expirados=${expired} activeSync=${activeSyncRes.procesados} weekly=${weeklyRes.procesados} monthly=${monthlyRes.procesados} patientsSnap=${patientsRes.procesados} clinicsSnap=${clinicsSnapRes.procesados} usage=${usageRes.procesados} alertas=${alertasRes.generadas}`,
    );
    return {
      expired,
      activeSync: activeSyncRes.procesados,
      weekly: weeklyRes.procesados,
      monthly: monthlyRes.procesados,
      patientsSnap: patientsRes.procesados,
      clinicsSnap: clinicsSnapRes.procesados,
      usage: usageRes.procesados,
      alertas: alertasRes.generadas,
    };
  },
});
