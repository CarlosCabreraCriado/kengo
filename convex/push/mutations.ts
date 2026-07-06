import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";

const PLATFORM = v.union(v.literal("ios"), v.literal("android"));

/**
 * Upsert de un push token para el usuario autenticado.
 *
 * Idempotente: si ya existe un registro para (userId, deviceId) actualiza
 * `token` y los timestamps. Si el mismo `token` aparece asociado a otro
 * (userId, deviceId) — caso de reinstall con login distinto — borra el
 * registro huérfano para evitar enviar push al usuario antiguo.
 */
export const registerPushToken = mutation({
  args: {
    token: v.string(),
    platform: PLATFORM,
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();

    const conflicts = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .collect();
    for (const c of conflicts) {
      if (c.userId !== user._id || c.deviceId !== args.deviceId) {
        await ctx.db.delete(c._id);
      }
    }

    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId_deviceId", (q) =>
        q.eq("userId", user._id).eq("deviceId", args.deviceId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        token: args.token,
        platform: args.platform,
        updatedAt: now,
        lastSeenAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("pushTokens", {
      userId: user._id,
      token: args.token,
      platform: args.platform,
      deviceId: args.deviceId,
      updatedAt: now,
      lastSeenAt: now,
    });
  },
});

/**
 * Borra el push token del usuario autenticado para el dispositivo dado.
 * Se invoca en logout para que el dispositivo deje de recibir push del
 * usuario que estaba logueado.
 */
export const unregisterPushToken = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const user = await getAuthenticatedUser(ctx);
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId_deviceId", (q) =>
        q.eq("userId", user._id).eq("deviceId", deviceId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

/**
 * Borra un push token por id. Internal: solo lo invoca la action FCM al
 * recibir UNREGISTERED / INVALID_ARGUMENT (token inválido en el server FCM).
 */
export const deletePushTokenById = internalMutation({
  args: { tokenId: v.id("pushTokens") },
  handler: async (ctx, { tokenId }) => {
    const existing = await ctx.db.get(tokenId);
    if (existing) {
      await ctx.db.delete(tokenId);
    }
    return null;
  },
});
