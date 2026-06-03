/**
 * Backfill del DirectAggregate `patientsByClinicDolor` desde
 * `patientMetricsSnapshot`.
 *
 * Idempotente: usa `insertIfDoesNotExist`. Necesario tras desplegar PR H6
 * para que `recomputeClinic.dolorMedio` (sum/count sobre el aggregate) tenga
 * datos antes del primer ciclo de `daily-maintenance`.
 *
 * **Importante**: pasa `sumValue: snap.dolorPromedio` explícito para que
 * `sum()` devuelva la suma de dolores. Por defecto DirectAggregate asume
 * `sumValue = 0`.
 *
 * Orden de ejecución en dev/staging:
 *   npx convex run migrations/backfillPatientsByClinicDolor:run \
 *     '{"fn":"migrations/backfillPatientsByClinicDolor:backfill"}'
 *
 * No requiere `clearAll` previo: el aggregate se crea vacío con este PR.
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { patientsByClinicDolor } from "../aggregates/patientsByClinicDolor";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfill = migrations.define({
  table: "patientMetricsSnapshot",
  migrateOne: async (ctx, snap) => {
    if (snap.dolorPromedio == null) return;
    await patientsByClinicDolor.insertIfDoesNotExist(ctx, {
      namespace: [snap.clinicId, snap.ventana],
      key: snap.dolorPromedio,
      id: snap.pacienteId,
      sumValue: snap.dolorPromedio,
    });
  },
});

// Runner genérico: requiere `fn` en runtime.
//   npx convex run migrations/backfillPatientsByClinicDolor:run \
//     '{"fn":"migrations/backfillPatientsByClinicDolor:backfill"}'
export const run = migrations.runner();
