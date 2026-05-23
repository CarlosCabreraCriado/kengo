/**
 * Migración: backfill de `clinics.ownerUserId` (Bloque J del plan
 * production-ready Stripe).
 *
 * Para cada `clinic` sin `ownerUserId`:
 *   1. Buscar sus `clinicMemberships` con `puesto === "admin"`.
 *   2. Elegir el admin más antiguo por `_creationTime`.
 *   3. Asignar como `ownerUserId`.
 *
 * Si una clínica no tiene ningún admin (caso teóricamente imposible pero
 * defensivo), se deja sin owner y se reporta en `pendientes` para
 * resolución manual.
 *
 * Cómo ejecutar:
 *   1. Dry-run (no aplica cambios):
 *      npx convex run migrations/backfillClinicOwner:run '{ "apply": false }'
 *
 *   2. Aplicar tras revisar el log:
 *      npx convex run migrations/backfillClinicOwner:run '{ "apply": true }'
 *      npx convex run migrations/backfillClinicOwner:run '{ "apply": true }' --prod
 *
 * Una vez confirmadas 0 clínicas pendientes (o resueltas manualmente
 * asignando `ownerUserId`), promover el campo a no-opcional en
 * `convex/schema.ts`.
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type Pendiente = {
  clinicId: Id<"clinics">;
  nombre: string;
  motivo: "sin_admin";
};

type Asignado = {
  clinicId: Id<"clinics">;
  ownerUserId: Id<"users">;
  totalAdmins: number;
};

export const run = internalMutation({
  args: {
    /** `true` aplica los cambios. `false` (default) hace dry-run. */
    apply: v.optional(v.boolean()),
  },
  handler: async (ctx, { apply = false }) => {
    const clinics = await ctx.db.query("clinics").collect();

    let yaConOwner = 0;
    const asignados: Asignado[] = [];
    const pendientes: Pendiente[] = [];

    for (const clinic of clinics) {
      if (clinic.ownerUserId) {
        yaConOwner++;
        continue;
      }

      const memberships = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
        .collect();
      const admins = memberships.filter((m) => m.puesto === "admin");

      if (admins.length === 0) {
        pendientes.push({
          clinicId: clinic._id,
          nombre: clinic.nombre,
          motivo: "sin_admin",
        });
        continue;
      }

      // Admin más antiguo por _creationTime.
      admins.sort((a, b) => a._creationTime - b._creationTime);
      const oldestAdmin = admins[0]!;

      if (apply) {
        await ctx.db.patch(clinic._id, { ownerUserId: oldestAdmin.userId });
      }
      asignados.push({
        clinicId: clinic._id,
        ownerUserId: oldestAdmin.userId,
        totalAdmins: admins.length,
      });
    }

    const modo = apply ? "APPLY" : "DRY-RUN";
    console.log(
      `[backfillClinicOwner ${modo}] yaConOwner=${yaConOwner} asignados=${asignados.length} pendientes=${pendientes.length}`,
    );

    if (asignados.length > 0) {
      console.log(
        `[backfillClinicOwner ${modo}] asignados:`,
        JSON.stringify(asignados, null, 2),
      );
    }

    if (pendientes.length > 0) {
      console.log(
        `[backfillClinicOwner ${modo}] pendientes (revisar manualmente):`,
        JSON.stringify(pendientes, null, 2),
      );
    }

    return { yaConOwner, asignados, pendientes, applied: apply };
  },
});
