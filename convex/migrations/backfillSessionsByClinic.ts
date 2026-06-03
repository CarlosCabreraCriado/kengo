/**
 * Backfill paginado del aggregate `sessionsByClinic` desde la tabla `sessions`.
 *
 * Idempotente: usa `insertIfDoesNotExist` por documento. El trigger registrado
 * desde Fase 0 (commit `5fd74b4`) ya pobla el aggregate para sesiones nuevas;
 * este backfill cubre sesiones anteriores al registro del trigger.
 *
 * No requiere `clearAll` previo: el namespace (`clinicId`) no ha cambiado y
 * `insertIfDoesNotExist` no duplica entradas existentes.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillSessionsByClinic:run \
 *     '{"fn":"migrations/backfillSessionsByClinic:backfill"}'
 *   npx convex run migrations/backfillSessionsByClinic:run --prod \
 *     '{"fn":"migrations/backfillSessionsByClinic:backfill"}'
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { sessionsByClinic } from "../aggregates/sessionsByClinic";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfill = migrations.define({
  table: "sessions",
  migrateOne: async (ctx, doc) => {
    await sessionsByClinic.insertIfDoesNotExist(ctx, doc);
  },
});

// Runner genérico: requiere `fn` en runtime.
//   npx convex run migrations/backfillSessionsByClinic:run \
//     '{"fn":"migrations/backfillSessionsByClinic:backfill"}'
export const run = migrations.runner();
