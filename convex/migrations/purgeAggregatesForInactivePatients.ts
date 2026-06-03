/**
 * Backfill retroactivo de la cascada H6c.
 *
 * Itera todos los `patientMetricsSnapshot` y, para cada
 * `(pacienteId, clinicId)`, invoca `_syncPatientActiveStateInClinic`.
 * El helper purga los aggregates por ventana cuando el paciente no tiene
 * plan en curso e inserta en `patientsWithActivePlanByClinic` cuando sí
 * lo tiene; ambos sentidos son idempotentes.
 *
 * Ya ejecutada en dev y prod en commit `7ecd23e` (versión previa con
 * `_purgeAggregatesForInactivePatient`). Tras F7-close el helper hace
 * lo mismo y además sincroniza el aggregate Active — re-ejecutar es
 * idempotente y seguro.
 *
 * Orden de ejecución:
 *   npx convex run migrations/purgeAggregatesForInactivePatients:run \
 *     '{"fn":"migrations/purgeAggregatesForInactivePatients:backfill"}'
 *
 * NO se borra el documento snapshot — solo entries de los aggregates.
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { _syncPatientActiveStateInClinic } from "../snapshots/internal";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfill = migrations.define({
  table: "patientMetricsSnapshot",
  migrateOne: async (ctx, snap) => {
    await _syncPatientActiveStateInClinic(
      ctx,
      snap.pacienteId,
      snap.clinicId,
    );
  },
});

export const run = migrations.runner();
