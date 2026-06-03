/**
 * Limpia por completo el aggregate `patientsByClinicDolor`.
 *
 * Útil cuando se sospecha drift por el bug de sync no-op
 * (AUDITORIA_AGGREGATES_CONVEX.md Bug 3) y se quiere reconstruir desde
 * cero a partir de `patientMetricsSnapshot`.
 *
 * Cómo ejecutar (dev):
 *   npx convex run migrations/clearPatientsByClinicDolor:run
 *   npx convex run migrations:run \
 *     '{"fn":"migrations/backfillPatientsByClinicDolor:backfill"}'
 */

import { internalMutation } from "../_generated/server";
import { patientsByClinicDolor } from "../aggregates/patientsByClinicDolor";

export const run = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    await patientsByClinicDolor.clearAll(ctx);
    console.log(
      "[clearPatientsByClinicDolor] vaciado. Ejecutar a continuación: " +
        "npx convex run migrations:run " +
        "'{\"fn\":\"migrations/backfillPatientsByClinicDolor:backfill\"}'",
    );
  },
});
