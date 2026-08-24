import { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_helpers/mutationWithTriggers";
import { getCurrentDateInTz } from "../_helpers/datetime";
import { TzCache } from "../_helpers/patientTz";
import { _syncPatientActiveStateInClinic } from "../snapshots/internal";

export async function expireOverduePlansImpl(ctx: MutationCtx): Promise<number> {
  // Un plan expira cuando su último día ya pasó PARA SU PACIENTE (su TZ):
  // el criterio anterior (día UTC) podía cerrar el último día del plan antes
  // de tiempo para TZs al oeste.
  const tzCache = new TzCache(ctx);

  const activePlans = await ctx.db
    .query("plans")
    .withIndex("by_estado", (q) => q.eq("estado", "activo"))
    .collect();

  let updated = 0;
  for (const plan of activePlans) {
    const today = getCurrentDateInTz(await tzCache.get(plan.pacienteId));
    if (plan.fechaFin && plan.fechaFin < today) {
      await ctx.db.patch(plan._id, { estado: "completado" });
      if (plan.clinicId) {
        await _syncPatientActiveStateInClinic(
          ctx,
          plan.pacienteId,
          plan.clinicId,
        );
      }
      updated++;
    }
  }

  return updated;
}

export const expireOverduePlans = internalMutation({
  args: {},
  handler: async (ctx) => {
    const updated = await expireOverduePlansImpl(ctx);
    console.log(
      `expireOverduePlans: ${updated} planes marcados como completados`,
    );
  },
});
