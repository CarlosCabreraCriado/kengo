import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "./queries";

/**
 * Upsert parcial de las preferencias del usuario autenticado. Solo se
 * sobrescriben las claves explícitamente pasadas; el resto conserva valor o
 * adopta el default si era la primera vez.
 */
export const updateMyPreferences = mutation({
  args: {
    chat: v.optional(v.boolean()),
    dailyReminder: v.optional(v.boolean()),
    newPlan: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      const patch: Record<string, unknown> = { updatedAt: now };
      if (args.chat !== undefined) patch["chat"] = args.chat;
      if (args.dailyReminder !== undefined)
        patch["dailyReminder"] = args.dailyReminder;
      if (args.newPlan !== undefined) patch["newPlan"] = args.newPlan;
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("notificationPreferences", {
      userId: user._id,
      chat: args.chat ?? DEFAULT_NOTIFICATION_PREFERENCES.chat,
      dailyReminder:
        args.dailyReminder ?? DEFAULT_NOTIFICATION_PREFERENCES.dailyReminder,
      newPlan: args.newPlan ?? DEFAULT_NOTIFICATION_PREFERENCES.newPlan,
      updatedAt: now,
    });
  },
});
