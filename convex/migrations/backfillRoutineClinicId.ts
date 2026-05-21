/**
 * Migración: backfill de `clinicId` en `routines`.
 *
 * Reglas:
 *   - `visibilidad === "privado"` → debe quedar sin `clinicId`. Si tiene uno
 *     residual, se elimina.
 *   - `visibilidad === "clinica"` y ya tiene `clinicId` → no se toca.
 *   - `visibilidad === "clinica"` y NO tiene `clinicId`:
 *       · Si el autor solo tiene una membresía con rol de gestión (fisio o
 *         admin) → se asigna esa clínica.
 *       · Si tiene varias o ninguna → se anota como pendiente y NO se modifica.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillRoutineClinicId:run
 *   npx convex run migrations/backfillRoutineClinicId:run --prod
 *
 * Las rutinas pendientes deberán resolverse manualmente (preguntar al autor
 * a qué clínica corresponde) antes de promover la regla a obligatoria en las
 * mutations.
 */

import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { tieneGestion } from "../_helpers/permissions";

type Pendiente = {
  routineId: Id<"routines">;
  motivo: "autor_multi_clinica" | "autor_sin_clinica";
  autorId: Id<"users">;
  clinicIdsCandidatos: Id<"clinics">[];
};

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const routines = await ctx.db.query("routines").collect();

    let privadasLimpiadas = 0;
    let yaConClinica = 0;
    let backfilled = 0;
    const pendientes: Pendiente[] = [];

    for (const r of routines) {
      if (r.visibilidad === "privado") {
        if (r.clinicId !== undefined) {
          await ctx.db.patch(r._id, { clinicId: undefined });
          privadasLimpiadas++;
        }
        continue;
      }

      // visibilidad === "clinica"
      if (r.clinicId) {
        yaConClinica++;
        continue;
      }

      const memberships = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_userId", (q) => q.eq("userId", r.autorId))
        .collect();

      const gestionables = memberships
        .filter((m) => tieneGestion(m.puesto))
        .map((m) => m.clinicId);

      if (gestionables.length === 1) {
        await ctx.db.patch(r._id, { clinicId: gestionables[0] });
        backfilled++;
        continue;
      }

      pendientes.push({
        routineId: r._id,
        motivo: gestionables.length === 0 ? "autor_sin_clinica" : "autor_multi_clinica",
        autorId: r.autorId,
        clinicIdsCandidatos: gestionables,
      });
    }

    console.log(
      `[backfillRoutineClinicId] privadasLimpiadas=${privadasLimpiadas} yaConClinica=${yaConClinica} backfilled=${backfilled} pendientes=${pendientes.length}`,
    );

    if (pendientes.length > 0) {
      console.log("[backfillRoutineClinicId] pendientes:", JSON.stringify(pendientes, null, 2));
    }

    return { privadasLimpiadas, yaConClinica, backfilled, pendientes };
  },
});
