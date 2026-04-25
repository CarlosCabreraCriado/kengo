import { v } from "convex/values";
import { query } from "../_generated/server";

export const getById = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const listByPaciente = query({
  args: { pacienteId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_pacienteId", (q) => q.eq("pacienteId", args.pacienteId))
      .collect();
  },
});
