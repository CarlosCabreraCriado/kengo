/**
 * Backfill paginado del flag `tambienEsPaciente` en `clinicMemberships`.
 *
 * Tras introducir el flag, todo fisio/admin debe quedar marcado como su
 * propio paciente en la clínica donde trabaja para que pueda ver el modo
 * paciente, autoasignarse planes y aparecer en las queries de paciente con
 * `userId === pacienteId`. Las membresías con `puesto === "paciente"` no
 * necesitan el flag (es redundante).
 *
 * Idempotente: solo escribe cuando el flag no está ya en `true`.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/setTambienEsPacienteForFisios:run \
 *     '{"fn":"migrations/setTambienEsPacienteForFisios:backfill"}'
 *   npx convex run migrations/setTambienEsPacienteForFisios:run --prod \
 *     '{"fn":"migrations/setTambienEsPacienteForFisios:backfill"}'
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfill = migrations.define({
  table: "clinicMemberships",
  migrateOne: async (ctx, doc) => {
    if (doc.puesto === "paciente") return;
    if (doc.tambienEsPaciente === true) return;
    await ctx.db.patch(doc._id, { tambienEsPaciente: true });
  },
});

export const run = migrations.runner();
