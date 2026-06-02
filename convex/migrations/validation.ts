/**
 * Queries de validación post-drop legacy.
 *
 * Cómo se ejecuta:
 *   npx convex run migrations/validation:summary
 *
 * Tras Fase 5, las tablas legacy (`planRecords`, `dailyCompliance`,
 * `clinicMetrics`, `physioNotifications`) se eliminaron. Este archivo
 * mantiene únicamente el `summary` del modelo nuevo para sanidad.
 */

import { internalQuery } from "../_generated/server";

/**
 * Conteos globales por tabla del modelo nuevo. Sanity check rápido.
 */
export const summary = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [
      sessionsAll,
      exerciseExecutions,
      dailyPatientRollup,
      weeklyPatientRollup,
      monthlyPatientRollup,
      patientMetricsSnapshot,
      clinicMetricsSnapshot,
      exerciseUsageRollup,
      physioAlerts,
    ] = await Promise.all([
      ctx.db.query("sessions").collect(),
      ctx.db.query("exerciseExecutions").collect(),
      ctx.db.query("dailyPatientRollup").collect(),
      ctx.db.query("weeklyPatientRollup").collect(),
      ctx.db.query("monthlyPatientRollup").collect(),
      ctx.db.query("patientMetricsSnapshot").collect(),
      ctx.db.query("clinicMetricsSnapshot").collect(),
      ctx.db.query("exerciseUsageRollup").collect(),
      ctx.db.query("physioAlerts").collect(),
    ]);

    const sesionesSinteticas = sessionsAll.filter(
      (s) => s.esSintetica === true,
    ).length;
    const sesionesEnCurso = sessionsAll.filter(
      (s) => s.estado === "en_curso",
    ).length;
    const sesionesCompletadas = sessionsAll.filter(
      (s) => s.estado === "completada",
    ).length;
    const sesionesParciales = sessionsAll.filter(
      (s) => s.estado === "completada_parcial",
    ).length;
    const alertasPendientes = physioAlerts.filter(
      (a) => a.estado === "pendiente",
    ).length;
    const rollupsStaleW = weeklyPatientRollup.filter((w) => w.stale).length;
    const rollupsStaleM = monthlyPatientRollup.filter((m) => m.stale).length;

    // Conteos de rollups legados sin `clinicId`. Útil para monitorizar el
    // progreso del backfill 3b. Cuando los tres sean 0 se puede promover el
    // schema a estricto (sub-fase 3c).
    const dailySinClinicId = dailyPatientRollup.filter((d) => !d.clinicId).length;
    const weeklySinClinicId = weeklyPatientRollup.filter((w) => !w.clinicId).length;
    const monthlySinClinicId = monthlyPatientRollup.filter((m) => !m.clinicId).length;

    return {
      sessions: {
        total: sessionsAll.length,
        sinteticas: sesionesSinteticas,
        enCurso: sesionesEnCurso,
        completadas: sesionesCompletadas,
        parciales: sesionesParciales,
      },
      exerciseExecutions: exerciseExecutions.length,
      dailyPatientRollup: dailyPatientRollup.length,
      weeklyPatientRollup: weeklyPatientRollup.length,
      monthlyPatientRollup: monthlyPatientRollup.length,
      patientMetricsSnapshot: patientMetricsSnapshot.length,
      clinicMetricsSnapshot: clinicMetricsSnapshot.length,
      exerciseUsageRollup: exerciseUsageRollup.length,
      physioAlerts: physioAlerts.length,
      alertasPendientes,
      stale: {
        weekly: rollupsStaleW,
        monthly: rollupsStaleM,
      },
      rollupsSinClinicId: {
        daily: dailySinClinicId,
        weekly: weeklySinClinicId,
        monthly: monthlySinClinicId,
      },
    };
  },
});
