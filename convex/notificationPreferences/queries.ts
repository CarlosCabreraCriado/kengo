import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { Id } from "../_generated/dataModel";

export type NotificationPreferences = {
  chat: boolean;
  dailyReminder: boolean;
  newPlan: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  chat: true,
  dailyReminder: true,
  newPlan: true,
};

async function readPreferences(
  ctx: { db: any },
  userId: Id<"users">,
): Promise<NotificationPreferences> {
  const row = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();
  if (!row) return DEFAULT_NOTIFICATION_PREFERENCES;
  return {
    chat: row.chat,
    dailyReminder: row.dailyReminder,
    newPlan: row.newPlan,
  };
}

/**
 * Preferencias de notificación del usuario autenticado. Si no existe registro
 * se devuelven los defaults (todo true), de forma que la UI pueda renderizar
 * los toggles sin tener que llamar a una mutation de inicialización.
 */
export const getMyPreferences = query({
  args: {},
  handler: async (ctx): Promise<NotificationPreferences> => {
    const user = await getAuthenticatedUser(ctx);
    return await readPreferences(ctx, user._id);
  },
});

/**
 * Internal: usada por `push.actions.sendPushToUser` para decidir si enviar
 * según la `notificationKey`. No usa autenticación porque corre desde una
 * action del scheduler.
 */
export const getPreferencesForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<NotificationPreferences> => {
    return await readPreferences(ctx, userId);
  },
});
