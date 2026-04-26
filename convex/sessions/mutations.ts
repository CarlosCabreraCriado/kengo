import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { insertCommentNotificationFromSession } from "../_helpers/notifications";

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

    if (args.observacionesGenerales?.trim()) {
      await insertCommentNotificationFromSession(ctx, args.sessionId);
    }
  },
});
