/**
 * Backfill retroactivo de la cascada H6c.
 *
 * Itera todos los `patientMetricsSnapshot` y, para cada
 * `(pacienteId, clinicId)` que NO tenga plan `activo` en esa clínica,
 * invoca `_purgeAggregatesForInactivePatient`. Limpia el drift histórico
 * que se acumuló antes del fix (pacientes con tratamiento completado
 * cuyos snapshots/aggregates quedaron congelados con adherencia=0).
 *
 * Idempotente: el helper hace el check interno; los snapshots de
 * pacientes con plan activo se ignoran. Si el mismo
 * `(pacienteId, clinicId)` aparece en varias ventanas, las pasadas
 * después de la primera devolverán `purgadas: 0`.
 *
 * Orden de ejecución en dev/staging:
 *   npx convex run migrations/purgeAggregatesForInactivePatients:run \
 *     '{"fn":"migrations/purgeAggregatesForInactivePatients:backfill"}'
 *
 * NO se borra el documento snapshot — solo entries de los 3 aggregates
 * (`patientsByClinic{Adherencia,RiskScore,Dolor}`).
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { _purgeAggregatesForInactivePatient } from "../snapshots/internal";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfill = migrations.define({
  table: "patientMetricsSnapshot",
  migrateOne: async (ctx, snap) => {
    await _purgeAggregatesForInactivePatient(
      ctx,
      snap.pacienteId,
      snap.clinicId,
    );
  },
});

export const run = migrations.runner();
