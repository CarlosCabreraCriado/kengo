import { v } from "convex/values";
import { query } from "../_generated/server";

export const listByClinic = query({
  args: {
    clinicId: v.id("clinics"),
    tipo: v.optional(
      v.union(v.literal("fisioterapeuta"), v.literal("paciente")),
    ),
  },
  handler: async (ctx, args) => {
    const codes = await ctx.db
      .query("accessCodes")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .collect();
    return args.tipo ? codes.filter((c) => c.tipo === args.tipo) : codes;
  },
});
