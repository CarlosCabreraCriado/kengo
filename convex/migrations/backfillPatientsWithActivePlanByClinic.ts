/**
 * Backfill paginado del aggregate `patientsWithActivePlanByClinic` desde la
 * tabla `plans`. Necesario tras crear el aggregate (F7-close) para poblar
 * las clínicas con su set de pacientes en curso antes de que
 * `recomputeClinicForWindow` empiece a leerlo.
 *
 * Itera planes con `estado === "activo"` y delega en
 * `_syncPatientActiveStateInClinic`, que comprueba internamente
 * `isPlanEnCurso(plan, hoyMadrid)`: planes activos cuya `fechaInicio` es
 * futura o `fechaFin` ya pasó NO entran al aggregate (idempotente y
 * coherente con la semántica del helper en runtime).
 *
 * Idempotente: `insertIfDoesNotExist` por (clinicId, pacienteId) → un
 * paciente con N planes activos genera 1 entry; pares vistos en pasadas
 * anteriores son no-op.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillPatientsWithActivePlanByClinic:run \
 *     '{"fn":"migrations/backfillPatientsWithActivePlanByClinic:backfill"}'
 *   npx convex run migrations/backfillPatientsWithActivePlanByClinic:run --prod \
 *     '{"fn":"migrations/backfillPatientsWithActivePlanByClinic:backfill"}'
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { _syncPatientActiveStateInClinic } from "../snapshots/internal";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfill = migrations.define({
  table: "plans",
  migrateOne: async (ctx, doc) => {
    if (!doc.clinicId) return;
    if (doc.estado !== "activo") return;
    await _syncPatientActiveStateInClinic(ctx, doc.pacienteId, doc.clinicId);
  },
});

export const run = migrations.runner();
