/**
 * Tercera pasada de backfill para planes que `backfillPlanClinicIdFallback`
 * dejó pendientes con motivo `sin_clinica_compartida` (paciente y fisio no
 * coinciden hoy en ninguna clínica — típico cuando el fisio dejó la clínica
 * donde sigue el paciente).
 *
 * Estrategia: ignorar al fisio y atribuir el plan a la clínica donde el
 * paciente sigue siendo `paciente`.
 *   - Si el paciente tiene exactamente UNA clínica como paciente → asignar.
 *   - Si tiene varias → pendiente (`multiples_clinicas_paciente`).
 *   - Si tiene cero → pendiente (`paciente_sin_clinica`). El plan habla de
 *     un paciente que también dejó la clínica; hay que decidir caso a caso.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillPlanClinicIdFromPatient:run
 *   npx convex run migrations/backfillPlanClinicIdFromPatient:run --prod
 */

import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type Pendiente = {
  planId: Id<"plans">;
  motivo: "multiples_clinicas_paciente" | "paciente_sin_clinica";
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

      const memPaciente = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_userId", (q) => q.eq("userId", plan.pacienteId))
        .collect();

      const clinicasPaciente = Array.from(
        new Set(
          memPaciente
            .filter((m) => m.puesto === "paciente")
            .map((m) => m.clinicId),
        ),
      );

      if (clinicasPaciente.length === 1) {
        await ctx.db.patch(plan._id, { clinicId: clinicasPaciente[0] });
        backfilled++;
        continue;
      }

      pendientes.push({
        planId: plan._id,
        motivo:
          clinicasPaciente.length === 0
            ? "paciente_sin_clinica"
            : "multiples_clinicas_paciente",
        pacienteId: plan.pacienteId,
        fisioId: plan.fisioId,
        clinicIdsCandidatos: clinicasPaciente,
      });
    }

    console.log(
      `[backfillPlanClinicIdFromPatient] yaConClinica=${yaConClinica} backfilled=${backfilled} pendientes=${pendientes.length}`,
    );

    if (pendientes.length > 0) {
      console.log(
        "[backfillPlanClinicIdFromPatient] pendientes:",
        JSON.stringify(pendientes, null, 2),
      );
    }

    return { yaConClinica, backfilled, pendientes };
  },
});
