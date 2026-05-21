/**
 * Migración: backfill de `clinicId` en `plans`.
 *
 * Para cada `plan` sin `clinicId`:
 *   1. Buscar `assignments` donde `pacienteId = plan.pacienteId` y
 *      `fisioId = plan.fisioId`.
 *   2. Si hay exactamente uno → `patch` con su `clinicId`.
 *   3. Si hay varios o ninguno → no se modifica el plan. Se registra en el
 *      array `pendientes` que devuelve la mutación para revisión manual.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillPlanClinicId:run
 *   npx convex run migrations/backfillPlanClinicId:run --prod
 *
 * Tras revisar los pendientes y asignarles `clinicId` manualmente (o
 * confirmar que no procede), se puede promover el campo `clinicId` a
 * obligatorio en `schema.ts` y en las mutations de `plans`.
 */

import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type Pendiente = {
  planId: Id<"plans">;
  motivo: "sin_assignment" | "assignments_multiples";
  pacienteId: Id<"users">;
  fisioId: Id<"users">;
  clinicIdsCandidatos: Id<"clinics">[];
};

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();

    let yaConClinica = 0;
    let backfilled = 0;
    const pendientes: Pendiente[] = [];

    for (const plan of plans) {
      if (plan.clinicId) {
        yaConClinica++;
        continue;
      }

      const assignments = await ctx.db
        .query("assignments")
        .withIndex("by_pacienteId_clinicId", (q) =>
          q.eq("pacienteId", plan.pacienteId),
        )
        .collect();

      const matches = assignments.filter((a) => a.fisioId === plan.fisioId);

      if (matches.length === 1) {
        await ctx.db.patch(plan._id, { clinicId: matches[0].clinicId });
        backfilled++;
        continue;
      }

      pendientes.push({
        planId: plan._id,
        motivo: matches.length === 0 ? "sin_assignment" : "assignments_multiples",
        pacienteId: plan.pacienteId,
        fisioId: plan.fisioId,
        clinicIdsCandidatos: matches.map((m) => m.clinicId),
      });
    }

    console.log(
      `[backfillPlanClinicId] yaConClinica=${yaConClinica} backfilled=${backfilled} pendientes=${pendientes.length}`,
    );

    if (pendientes.length > 0) {
      console.log("[backfillPlanClinicId] pendientes:", JSON.stringify(pendientes, null, 2));
    }

    return { yaConClinica, backfilled, pendientes };
  },
});
