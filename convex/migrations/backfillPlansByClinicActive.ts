/**
 * Backfill paginado del aggregate `plansByClinicActive` desde la tabla
 * `plans`. Sólo inserta planes con `estado === "activo"` — el mismo predicado
 * que aplica el `filteredTrigger` registrado en
 * `convex/aggregates/triggers.ts`.
 *
 * Idempotente: `insertIfDoesNotExist` por documento. Cubre planes preexistentes
 * a la Fase 0 (cuando se registró el trigger) que nunca recibieron un
 * insert/update y por tanto no entraron al árbol.
 *
 * Necesario antes de PR F8-simplify para que `recomputeAll*` lo lean como
 * fuente del set de trabajo (de lo contrario el shadow read `compareF8`
 * devuelve `pairsAgg: 0`).
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillPlansByClinicActive:run \
 *     '{"fn":"migrations/backfillPlansByClinicActive:backfill"}'
 *   npx convex run migrations/backfillPlansByClinicActive:run --prod \
 *     '{"fn":"migrations/backfillPlansByClinicActive:backfill"}'
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { plansByClinicActive } from "../aggregates/plansByClinicActive";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfill = migrations.define({
  table: "plans",
  migrateOne: async (ctx, doc) => {
    if (doc.estado !== "activo") return;
    await plansByClinicActive.insertIfDoesNotExist(ctx, doc);
  },
});

// Runner genérico: requiere `fn` en runtime.
//   npx convex run migrations/backfillPlansByClinicActive:run \
//     '{"fn":"migrations/backfillPlansByClinicActive:backfill"}'
export const run = migrations.runner();
