/**
 * Segunda pasada de backfill para planes que `backfillPlanClinicId` dejó
 * pendientes con motivo `sin_assignment`.
 *
 * Estrategia (más permisiva pero todavía segura):
 *   - Para cada plan sin `clinicId`, calcular la INTERSECCIÓN de clínicas
 *     donde el paciente es miembro `paciente` Y el fisio es miembro `fisio`
 *     o `admin`.
 *   - Si la intersección tiene exactamente UNA clínica → asignar.
 *   - Si tiene varias o ninguna → dejar pendiente para revisión manual
 *     (script `inspectPendingPlans` o mutation `patchPlanClinicId`).
 *
 * No usa la tabla `assignments`; resuelve los casos en los que el plan se
 * creó sin que se llegase a registrar la relación "fisio responsable".
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillPlanClinicIdFallback:run
 *   npx convex run migrations/backfillPlanClinicIdFallback:run --prod
 */

import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type Pendiente = {
  planId: Id<"plans">;
  motivo:
    | "sin_clinica_compartida"
    | "multiples_clinicas_compartidas";
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

      const [memPaciente, memFisio] = await Promise.all([
        ctx.db
          .query("clinicMemberships")
          .withIndex("by_userId", (q) => q.eq("userId", plan.pacienteId))
          .collect(),
        ctx.db
          .query("clinicMemberships")
          .withIndex("by_userId", (q) => q.eq("userId", plan.fisioId))
          .collect(),
      ]);

      const pacienteClinicas = new Set(
        memPaciente
          .filter((m) => m.puesto === "paciente")
          .map((m) => m.clinicId),
      );
      const fisioClinicas = memFisio
        .filter((m) => m.puesto === "fisio" || m.puesto === "admin")
        .map((m) => m.clinicId);

      const interseccion = Array.from(
        new Set(fisioClinicas.filter((c) => pacienteClinicas.has(c))),
      );

      if (interseccion.length === 1) {
        await ctx.db.patch(plan._id, { clinicId: interseccion[0] });
        backfilled++;
        continue;
      }

      pendientes.push({
        planId: plan._id,
        motivo:
          interseccion.length === 0
            ? "sin_clinica_compartida"
            : "multiples_clinicas_compartidas",
        pacienteId: plan.pacienteId,
        fisioId: plan.fisioId,
        clinicIdsCandidatos: interseccion,
      });
    }

    console.log(
      `[backfillPlanClinicIdFallback] yaConClinica=${yaConClinica} backfilled=${backfilled} pendientes=${pendientes.length}`,
    );

    if (pendientes.length > 0) {
      console.log(
        "[backfillPlanClinicIdFallback] pendientes:",
        JSON.stringify(pendientes, null, 2),
      );
    }

    return { yaConClinica, backfilled, pendientes };
  },
});
