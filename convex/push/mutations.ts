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
 * Borra un push token por id. Internal: solo lo invoca la action FCM cuando
 * FCM confirma que el token ya no está registrado (404 / UNREGISTERED /
 * registration-token-not-registered). NO se borra por errores genéricos de
 * argumento, que pueden deberse a un payload malformado y no al token.
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

const NOTIFICATION_KEY = v.union(
  v.literal("chat"),
  v.literal("dailyReminder"),
  v.literal("newPlan"),
);

const SEND_RESULT = v.union(
  v.literal("ok"),
  v.literal("sin_token"),
  v.literal("prefs_off"),
  v.literal("error"),
  v.literal("stale"),
  v.literal("sin_service_account"),
);

/**
 * Registra el resultado de un envío push en `pushSendLog`. Internal: lo invoca
 * `push.actions.sendPushToUser`. Best-effort para diagnóstico; no debe romper
 * el envío si falla.
 */
export const logPushResult = internalMutation({
  args: {
    userId: v.id("users"),
    notificationKey: v.optional(NOTIFICATION_KEY),
    resultado: SEND_RESULT,
    detalle: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pushSendLog", {
      userId: args.userId,
      notificationKey: args.notificationKey,
      resultado: args.resultado,
      detalle: args.detalle,
      createdAt: args.createdAt,
    });
    return null;
  },
});

const PUSH_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Purga registros de `pushSendLog` con más de 30 días. Internal: lo invoca el
 * cron diario de mantenimiento. Borra hasta 500 por ejecución (el volumen
 * diario de envíos es bajo, así que basta con un lote).
 */
export const purgeOldPushLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - PUSH_LOG_RETENTION_MS;
    const viejos = await ctx.db
      .query("pushSendLog")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(500);
    for (const doc of viejos) {
      await ctx.db.delete(doc._id);
    }
    return viejos.length;
  },
});
