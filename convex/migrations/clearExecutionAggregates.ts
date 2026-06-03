/**
 * Limpia por completo los aggregates `executionsByPaciente` y
 * `executionsByPacienteDolor`.
 *
 * Necesario UNA VEZ tras desplegar PR H5, antes de ejecutar
 * `migrations/backfillExecutionsByPaciente:run`. El cambio de namespace de
 * `Id<"users">` → `[Id<"users">, Id<"clinics">]` deja los árboles con datos
 * en formato incompatible (los escritos por triggers durante Fase 0); este
 * mutation los borra para que el backfill repueble desde cero con el
 * namespace correcto.
 *
 * Cómo ejecutar (dev):
 *   npx convex run migrations/clearExecutionAggregates:run
 *
 * No ejecutar en producción si el aggregate ya fue backfilleado: borra todo
 * y deja al sistema con datos inconsistentes hasta el siguiente backfill.
 */

import { internalMutation } from "../_generated/server";
import { executionsByPaciente } from "../aggregates/executionsByPaciente";
import { executionsByPacienteDolor } from "../aggregates/executionsByPacienteDolor";

export const run = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    await executionsByPaciente.clearAll(ctx);
    await executionsByPacienteDolor.clearAll(ctx);
    console.log(
      "[clearExecutionAggregates] executionsByPaciente y " +
        "executionsByPacienteDolor vaciados. Ejecutar a continuación: " +
        "npx convex run migrations/backfillExecutionsByPaciente:run",
    );
  },
});
