/**
 * Backfill paginado de los DirectAggregates `patientsByClinicAdherencia` y
 * `patientsByClinicRiskScore` desde `patientMetricsSnapshot`.
 *
 * Idempotente: usa `insertIfDoesNotExist`. Necesario tras desplegar PR H5
 * para que H1 (`getPatientMetrics` ordenado por adherencia) tenga datos en el
 * aggregate sin esperar al primer ciclo de `daily-maintenance`.
 *
 * IMPORTANTE — orden de ejecución en dev/staging:
 *   1. Limpiar y rellenar `executionsByPaciente`/`executionsByPacienteDolor`:
 *      npx convex run migrations/backfillExecutionsByPaciente:run
 *   2. Backfill de DirectAggregates con los valores ACTUALES del snapshot
 *      (fórmula legacy de adherencia):
 *      npx convex run migrations/backfillPatientDirectAggregates:run
 *   3. Recompute global con la fórmula nueva (sum/count) que sobreescribe
 *      los DirectAggregates con valores normalizados:
 *      npx convex run snapshots/internal:recomputeAllPatients
 *
 * El paso 2 deja los aggregates poblados inmediatamente; el paso 3 los
 * normaliza. Sin el paso 2, H1 leería un aggregate vacío hasta que el cron
 * diario corra (max 24h).
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { patientsByClinicAdherencia } from "../aggregates/patientsByClinicAdherencia";
import { patientsByClinicRiskScore } from "../aggregates/patientsByClinicRiskScore";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfill = migrations.define({
  table: "patientMetricsSnapshot",
  migrateOne: async (ctx, snap) => {
    const namespace: [typeof snap.clinicId, typeof snap.ventana] = [
      snap.clinicId,
      snap.ventana,
    ];
    if (snap.adherencia != null) {
      await patientsByClinicAdherencia.insertIfDoesNotExist(ctx, {
        namespace,
        key: snap.adherencia,
        id: snap.pacienteId,
      });
    }
    await patientsByClinicRiskScore.insertIfDoesNotExist(ctx, {
      namespace,
      key: snap.riskScore,
      id: snap.pacienteId,
    });
  },
});

// Runner genérico: requiere `fn` en runtime.
//   npx convex run migrations/backfillPatientDirectAggregates:run \
//     '{"fn":"migrations/backfillPatientDirectAggregates:backfill"}'
export const run = migrations.runner();
