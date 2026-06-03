import { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_helpers/mutationWithTriggers";
import { _syncPatientActiveStateInClinic } from "../snapshots/internal";

export async function expireOverduePlansImpl(ctx: MutationCtx): Promise<number> {
  const today = new Date().toISOString().split("T")[0];

  const activePlans = await ctx.db
    .query("plans")
    .withIndex("by_estado", (q) => q.eq("estado", "activo"))
    .collect();

  let updated = 0;
  for (const plan of activePlans) {
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
