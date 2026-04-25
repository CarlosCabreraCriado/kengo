import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Expirar planes vencidos — diario a las 05:00 UTC (07:00 Madrid)
crons.daily(
  "expire-overdue-plans",
  { hourUTC: 5, minuteUTC: 0 },
  internal.plans.internal.expireOverduePlans,
);

// Calcular cumplimiento diario — diario a las 08:00 UTC (10:00 Madrid)
crons.daily(
  "daily-compliance",
  { hourUTC: 8, minuteUTC: 0 },
  internal.compliance.internal.calculateDailyCompliance,
  {},
);

// Generar notificaciones para fisios — diario a las 13:00 UTC (15:00 Madrid)
crons.daily(
  "generate-physio-notifications",
  { hourUTC: 13, minuteUTC: 0 },
  internal.notifications.internal.generateNotifications,
  {},
);

export default crons;
