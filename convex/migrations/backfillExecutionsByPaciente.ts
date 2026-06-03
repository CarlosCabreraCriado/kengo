/**
 * Backfill paginado de los aggregates `executionsByPaciente` y
 * `executionsByPacienteDolor` desde la tabla `exerciseExecutions`.
 *
 * Idempotente: usa `insertIfDoesNotExist` por documento. Soporta resumability
 * vía cursor de `@convex-dev/migrations`. Necesario tras el cambio de
 * namespace a `[pacienteId, clinicId]` (PR H5): los datos escritos por los
 * triggers durante Fase 0 quedaron en un namespace incompatible y deben
 * limpiarse antes (vía `clearAll`) — este backfill los repuebla.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillExecutionsByPaciente:run
 *   npx convex run migrations/backfillExecutionsByPaciente:run --prod
 *
 * Para limpiar primero los aggregates en dev (necesario solo la primera vez
 * tras cambiar el namespace), ejecutar desde la consola Convex:
 *   import { executionsByPaciente } from "convex/aggregates/executionsByPaciente";
 *   await executionsByPaciente.clearAll(ctx);
 *   await executionsByPacienteDolor.clearAll(ctx);
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { executionsByPaciente } from "../aggregates/executionsByPaciente";
import { executionsByPacienteDolor } from "../aggregates/executionsByPacienteDolor";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfill = migrations.define({
  table: "exerciseExecutions",
  migrateOne: async (ctx, doc) => {
    await executionsByPaciente.insertIfDoesNotExist(ctx, doc);
    if (doc.completado && doc.dolorEscala != null) {
      await executionsByPacienteDolor.insertIfDoesNotExist(ctx, doc);
    }
  },
});

// Runner genérico: requiere `fn` en runtime.
//   npx convex run migrations/backfillExecutionsByPaciente:run \
//     '{"fn":"migrations/backfillExecutionsByPaciente:backfill"}'
export const run = migrations.runner();
