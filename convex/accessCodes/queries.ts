import { v } from "convex/values";
import { query } from "../_generated/server";

export const listByClinic = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accessCodes")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .collect();
  },
});
