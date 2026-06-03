/**
 * Limpia por completo el aggregate `patientsByClinicAdherencia`.
 *
 * Necesario una vez tras añadir `sumValue: adherencia` a sus inserciones
 * (PR H6b), antes de ejecutar
 * `migrations/backfillPatientsByClinicAdherencia:run`. Las entries previas
 * fueron insertadas con `sumValue = 0` (default), por lo que `sum()`
 * devolvía 0. El clearAll + backfill las repuebla con el `sumValue`
 * correcto.
 *
 * Cómo ejecutar (dev):
 *   npx convex run migrations/clearPatientsByClinicAdherencia:run
 *
 * No ejecutar en producción si el aggregate ya fue backfilleado tras el
 * fix: borra todo y deja el sistema con `adherenciaPromedio = 0` hasta el
 * siguiente backfill.
 */

import { internalMutation } from "../_generated/server";
import { patientsByClinicAdherencia } from "../aggregates/patientsByClinicAdherencia";

export const run = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    await patientsByClinicAdherencia.clearAll(ctx);
    console.log(
      "[clearPatientsByClinicAdherencia] vaciado. Ejecutar a continuación: " +
        "npx convex run migrations/backfillPatientsByClinicAdherencia:run " +
        "'{\"fn\":\"migrations/backfillPatientsByClinicAdherencia:backfill\"}'",
    );
  },
});
