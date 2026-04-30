import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Mantenimiento diario consolidado: expira planes vencidos + recalcula compliance.
// Hora fija: 03:00 UTC.
//   Península invierno: 04:00 / verano: 05:00
//   Canarias  invierno: 03:00 / verano: 04:00
crons.daily(
  "daily-maintenance",
  { hourUTC: 3, minuteUTC: 0 },
  internal.compliance.internal.dailyMaintenance,
  {},
);

// Limpieza semanal de keys huérfanas en R2 (avatars/logos/clinic-files que ya
// no están referenciadas en BD y tienen >7 días).
crons.weekly(
  "r2-orphan-cleanup",
  { dayOfWeek: "sunday", hourUTC: 4, minuteUTC: 0 },
  internal.storage.cleanup.cleanupOrphanR2Keys,
  {},
);

// Cierre nocturno de sesiones del día anterior (rediseño records — Fase 1).
// Hora fija: 02:00 UTC.
//   Península invierno (CET): 03:00 / verano (CEST): 04:00
//   Canarias  invierno (WET): 02:00 / verano (WEST): 03:00
// Se ejecuta antes que `daily-maintenance` (03:00 UTC) para que las sesiones
// del día anterior estén cerradas cuando éste recompute rollups y snapshots.
// El handler es un stub durante Fase 0; se rellena en Fase 1 funcional.
crons.daily(
  "nightly-session-close",
  { hourUTC: 2, minuteUTC: 0 },
  internal.sessions.internal.closeOpenSessionsAtEndOfDay,
  {},
);

// Periodos de gracia agotados: marca `unpaid` las clínicas en `past_due` cuyo
// `graceUntil` ya expiró. Hora 03:30 UTC, después del `daily-maintenance` para
// no solapar y dejar que cualquier `invoice.paid` del día anterior se procese
// antes.
crons.daily(
  "billing-grace-expired",
  { hourUTC: 3, minuteUTC: 30 },
  internal.billing.internal.checkGracePeriodsExpired,
  {},
);

export default crons;
