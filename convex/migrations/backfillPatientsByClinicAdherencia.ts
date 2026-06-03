/**
 * Backfill del DirectAggregate `patientsByClinicAdherencia` desde
 * `patientMetricsSnapshot`.
 *
 * Idempotente: usa `insertIfDoesNotExist`. Necesario tras el fix del
 * `sumValue` (PR H6b) para que `recomputeClinic.adherenciaPromedio`
 * (sum/count sobre el aggregate) tenga datos válidos.
 *
 * **Importante**: pasa `sumValue: snap.adherencia` explícito para que
 * `sum()` devuelva la suma de adherencias. Por defecto DirectAggregate
 * asume `sumValue = 0`.
 *
 * Orden de ejecución en dev/staging:
 *   npx convex run migrations/clearPatientsByClinicAdherencia:run
 *   npx convex run migrations/backfillPatientsByClinicAdherencia:run \
 *     '{"fn":"migrations/backfillPatientsByClinicAdherencia:backfill"}'
 *
 * Requiere `clearAll` previo: el aggregate ya contiene entries con
 * `sumValue = 0` heredadas del despliegue inicial sin el fix.
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { patientsByClinicAdherencia } from "../aggregates/patientsByClinicAdherencia";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfill = migrations.define({
  table: "patientMetricsSnapshot",
  migrateOne: async (ctx, snap) => {
    if (snap.adherencia == null) return;
    await patientsByClinicAdherencia.insertIfDoesNotExist(ctx, {
      namespace: [snap.clinicId, snap.ventana],
      key: snap.adherencia,
      id: snap.pacienteId,
      sumValue: snap.adherencia,
    });
  },
});

export const run = migrations.runner();
