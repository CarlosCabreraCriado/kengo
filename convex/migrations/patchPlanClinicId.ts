/**
 * Asigna manualmente `clinicId` a un plan concreto (o a varios). Pensada
 * para los irreductibles que ni `backfillPlanClinicId` ni
 * `backfillPlanClinicIdFallback` resolvieron, después de inspeccionarlos con
 * `inspectPendingPlans`.
 *
 * Cómo ejecutar (uno a uno):
 *   npx convex run migrations/patchPlanClinicId:run \
 *     '{ "patches": [{ "planId": "kx7...", "clinicId": "j97..." }] }'
 *
 * Si pasas `force: false` (por defecto), valida que la clínica indicada sea
 * una donde paciente y fisio coinciden con puestos compatibles. Si quieres
 * forzar un valor que rompe esa regla (caso excepcional, por ejemplo paciente
 * que ya dejó la clínica), pasa `force: true` por entrada.
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type Resultado =
  | { planId: Id<"plans">; ok: true }
  | { planId: Id<"plans">; ok: false; motivo: string };

export const run = internalMutation({
  args: {
    patches: v.array(
      v.object({
        planId: v.id("plans"),
        clinicId: v.id("clinics"),
        force: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const resultados: Resultado[] = [];

    for (const patch of args.patches) {
      const plan = await ctx.db.get(patch.planId);
      if (!plan) {
        resultados.push({
          planId: patch.planId,
          ok: false,
          motivo: "plan_no_encontrado",
        });
        continue;
      }

      if (!patch.force) {
        const [pacMem, fisioMem] = await Promise.all([
          ctx.db
            .query("clinicMemberships")
            .withIndex("by_userId_clinicId", (q) =>
              q.eq("userId", plan.pacienteId).eq("clinicId", patch.clinicId),
            )
            .unique(),
          ctx.db
            .query("clinicMemberships")
            .withIndex("by_userId_clinicId", (q) =>
              q.eq("userId", plan.fisioId).eq("clinicId", patch.clinicId),
            )
            .unique(),
        ]);

        if (!pacMem || pacMem.puesto !== "paciente") {
          resultados.push({
            planId: patch.planId,
            ok: false,
            motivo: "paciente_no_es_paciente_en_esta_clinica",
          });
          continue;
        }
        if (
          !fisioMem ||
          (fisioMem.puesto !== "fisio" && fisioMem.puesto !== "admin")
        ) {
          resultados.push({
            planId: patch.planId,
            ok: false,
            motivo: "fisio_no_es_fisio_en_esta_clinica",
          });
          continue;
        }
      }

      await ctx.db.patch(patch.planId, { clinicId: patch.clinicId });
      resultados.push({ planId: patch.planId, ok: true });
    }

    console.log("[patchPlanClinicId]", JSON.stringify(resultados, null, 2));
    return resultados;
  },
});
