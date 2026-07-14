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
 *
 * Los pendientes que deja `run` se resuelven de forma determinista con:
 *   npx convex run migrations/backfillRoutineClinicId:resolvePendientes
 *
 * Reglas de `resolvePendientes` (rutinas "clinica" sin clinicId restantes):
 *   - Autor con ≥1 clínica de gestión → se asigna la de membresía más
 *     antigua (el autor puede reasignarla después editando la rutina).
 *   - Autor sin clínica de gestión → se convierte a `visibilidad: "privado"`
 *     (bajo aislamiento estricto nadie más puede verla legítimamente).
 *
 * Tras ejecutar ambas, el invariante es: toda rutina "clinica" tiene clinicId.
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

/**
 * Resuelve los pendientes que `run` no pudo asignar automáticamente.
 * Idempotente: solo toca rutinas "clinica" sin `clinicId`.
 */
export const resolvePendientes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const routines = await ctx.db.query("routines").collect();

    let asignadas = 0;
    let convertidasAPrivado = 0;
    const detalle: Array<{
      routineId: Id<"routines">;
      accion: "clinicId_asignado" | "convertida_a_privado";
      clinicId?: Id<"clinics">;
    }> = [];

    for (const r of routines) {
      if (r.visibilidad !== "clinica" || r.clinicId) continue;

      const memberships = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_userId", (q) => q.eq("userId", r.autorId))
        .collect();

      const gestionables = memberships.filter((m) => tieneGestion(m.puesto));

      if (gestionables.length === 0) {
        await ctx.db.patch(r._id, { visibilidad: "privado" });
        convertidasAPrivado++;
        detalle.push({ routineId: r._id, accion: "convertida_a_privado" });
        continue;
      }

      // Determinista: la membresía de gestión más antigua del autor. El
      // autor puede reasignar la clínica después editando la rutina.
      const masAntigua = gestionables.reduce((a, b) =>
        a._creationTime <= b._creationTime ? a : b,
      );
      await ctx.db.patch(r._id, { clinicId: masAntigua.clinicId });
      asignadas++;
      detalle.push({
        routineId: r._id,
        accion: "clinicId_asignado",
        clinicId: masAntigua.clinicId,
      });
    }

    console.log(
      `[backfillRoutineClinicId:resolvePendientes] asignadas=${asignadas} convertidasAPrivado=${convertidasAPrivado}`,
    );
    if (detalle.length > 0) {
      console.log(
        "[backfillRoutineClinicId:resolvePendientes] detalle:",
        JSON.stringify(detalle, null, 2),
      );
    }

    return { asignadas, convertidasAPrivado, detalle };
  },
});
