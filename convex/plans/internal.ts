import { internalMutation } from "../_generated/server";

export const expireOverduePlans = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];

    const activePlans = await ctx.db
      .query("plans")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();

    let updated = 0;
    for (const plan of activePlans) {
      if (plan.fechaFin && plan.fechaFin < today) {
        await ctx.db.patch(plan._id, { estado: "completado" });
        updated++;
      }
    }

    console.log(`expireOverduePlans: ${updated} planes marcados como completados`);
  },
});
