import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const upsert = mutation({
  args: {
    fecha: v.string(),
    pacienteId: v.id("users"),
    planId: v.id("plans"),
    ejerciciosEsperados: v.number(),
    ejerciciosCompletados: v.number(),
    esDiaDescanso: v.boolean(),
    dolorPromedio: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyCompliance")
      .withIndex("by_pacienteId_planId_fecha", (q) =>
        q
          .eq("pacienteId", args.pacienteId)
          .eq("planId", args.planId)
          .eq("fecha", args.fecha),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ejerciciosEsperados: args.ejerciciosEsperados,
        ejerciciosCompletados: args.ejerciciosCompletados,
        esDiaDescanso: args.esDiaDescanso,
        dolorPromedio: args.dolorPromedio,
      });
      return existing._id;
    }

    return await ctx.db.insert("dailyCompliance", args);
  },
});
