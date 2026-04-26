import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Mantenimiento diario consolidado: expira planes vencidos + recalcula compliance.
// Se ejecuta a las 03:00 UTC (05:00 Madrid) para que esté listo al inicio del día.
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

export default crons;
