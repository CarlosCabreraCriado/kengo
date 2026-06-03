/**
 * Limpia por completo el aggregate `patientsByClinicRiskScore`.
 *
 * Útil cuando se sospecha drift por el bug de sync no-op
 * (AUDITORIA_AGGREGATES_CONVEX.md Bug 3) y se quiere reconstruir desde
 * cero a partir de `patientMetricsSnapshot`.
 *
 * Cómo ejecutar (dev):
 *   npx convex run migrations/clearPatientsByClinicRiskScore:run
 *   npx convex run migrations:run \
 *     '{"fn":"migrations/backfillPatientsByClinicRiskScore:backfill"}'
 */

import { internalMutation } from "../_generated/server";
import { patientsByClinicRiskScore } from "../aggregates/patientsByClinicRiskScore";

export const run = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    await patientsByClinicRiskScore.clearAll(ctx);
    console.log(
      "[clearPatientsByClinicRiskScore] vaciado. Ejecutar a continuación: " +
        "npx convex run migrations:run " +
        "'{\"fn\":\"migrations/backfillPatientsByClinicRiskScore:backfill\"}'",
    );
  },
});
