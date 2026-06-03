/**
 * Backfill del DirectAggregate `patientsByClinicRiskScore` desde
 * `patientMetricsSnapshot`.
 *
 * Idempotente: usa `insertIfDoesNotExist`. No necesita `sumValue` porque
 * este aggregate sólo se consulta por orden (`paginate` ASC/DESC), no por
 * `sum()`.
 *
 * Cómo ejecutar (dev):
 *   npx convex run migrations:run \
 *     '{"fn":"migrations/backfillPatientsByClinicRiskScore:backfill"}'
 *
 * No requiere `clearAll` previo en condiciones normales. Sólo si se sospecha
 * drift por el bug de sync no-op (AUDITORIA_AGGREGATES_CONVEX.md Bug 3):
 *   npx convex run migrations/clearPatientsByClinicRiskScore:run
 *   npx convex run migrations:run \
 *     '{"fn":"migrations/backfillPatientsByClinicRiskScore:backfill"}'
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { patientsByClinicRiskScore } from "../aggregates/patientsByClinicRiskScore";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfill = migrations.define({
  table: "patientMetricsSnapshot",
  migrateOne: async (ctx, snap) => {
    await patientsByClinicRiskScore.insertIfDoesNotExist(ctx, {
      namespace: [snap.clinicId, snap.ventana],
      key: snap.riskScore,
      id: snap.pacienteId,
    });
  },
});

export const run = migrations.runner();
