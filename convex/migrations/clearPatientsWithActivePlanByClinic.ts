/**
 * Limpia por completo el aggregate `patientsWithActivePlanByClinic`.
 *
 * Útil si en algún momento el aggregate diverge del estado real (por
 * ejemplo, tras una migración destructiva masiva sobre `plans`). Tras
 * ejecutar este `clearAll`, lanzar
 * `migrations/backfillPatientsWithActivePlanByClinic:run` para repoblarlo.
 *
 * Cómo ejecutar (dev):
 *   npx convex run migrations/clearPatientsWithActivePlanByClinic:run
 *
 * No ejecutar en producción salvo necesidad: deja `pacientesActivos = 0`
 * en todas las clínicas hasta que el backfill termine.
 */

import { internalMutation } from "../_generated/server";
import { patientsWithActivePlanByClinic } from "../aggregates/patientsWithActivePlanByClinic";

export const run = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    await patientsWithActivePlanByClinic.clearAll(ctx);
    console.log(
      "[clearPatientsWithActivePlanByClinic] vaciado. Ejecutar a continuación: " +
        "npx convex run migrations/backfillPatientsWithActivePlanByClinic:run " +
        "'{\"fn\":\"migrations/backfillPatientsWithActivePlanByClinic:backfill\"}'",
    );
  },
});
