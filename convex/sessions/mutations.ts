import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { getAuthenticatedUser } from "../_helpers/permissions";

export const create = mutation({
  args: {
    fechaInicio: v.string(),
    observacionesGenerales: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    return await ctx.db.insert("sessions", {
      pacienteId: user._id,
      fechaInicio: args.fechaInicio,
      completada: false,
    });
  },
});

export const complete = mutation({
  args: {
    sessionId: v.id("sessions"),
    fechaFin: v.string(),
    observacionesGenerales: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      fechaFin: args.fechaFin,
      observacionesGenerales: args.observacionesGenerales,
      completada: true,
    });

    if (
      args.observacionesGenerales &&
      args.observacionesGenerales.trim().length > 0
    ) {
      const session = await ctx.db.get(args.sessionId);
      if (session) {
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.internal.generateNotifications,
          { pacienteId: session.pacienteId },
        );
      }
    }
  },
});
