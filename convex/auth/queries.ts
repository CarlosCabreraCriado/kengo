import { v } from "convex/values";
import { internalQuery, query } from "../_generated/server";

const ONE_HOUR_MS = 60 * 60 * 1000;

export const emailExists = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    return !!user;
  },
});

/**
 * Versión pública de `emailExists` usada por el flujo de invitación
 * (`/invitacion`). Devuelve únicamente un booleano para que el frontend
 * decida si redirigir al login o al registro, sin exponer ningún dato
 * del usuario. Sigue siendo enumeración por email; aceptable en este
 * contexto porque el llamante ya conoce el email (lo recibió en la URL
 * de invitación dirigida).
 */
export const userExistsByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    if (!normalized) return { exists: false };
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    return { exists: !!user };
  },
});

export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
  },
});

// Convex ordena los índices simples por el campo + _creationTime como tiebreaker.
// .order("desc").take(N) recorre como máximo N filas en lugar de todo el historial.
const RATE_LIMIT_LOOKBACK = 20;
const UNUSED_LOOKBACK = 10;

export const countRecentRecoveryCodes = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    const oneHourAgo = Date.now() - ONE_HOUR_MS;

    const codes = await ctx.db
      .query("recoveryCodes")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .order("desc")
      .take(RATE_LIMIT_LOOKBACK);

    return codes.filter((c) => c._creationTime > oneHourAgo).length;
  },
});

export const countRecentVerificationCodes = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const oneHourAgo = Date.now() - ONE_HOUR_MS;

    const codes = await ctx.db
      .query("verificationCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(RATE_LIMIT_LOOKBACK);

    return codes.filter((c) => c._creationTime > oneHourAgo).length;
  },
});

export const getLatestUnusedRecoveryCode = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();

    const codes = await ctx.db
      .query("recoveryCodes")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .order("desc")
      .take(UNUSED_LOOKBACK);

    return codes.find((c) => !c.usado) ?? null;
  },
});

export const getLatestUnusedVerificationCode = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const codes = await ctx.db
      .query("verificationCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(UNUSED_LOOKBACK);

    return codes.find((c) => !c.usado) ?? null;
  },
});

export const findUserByExternalId = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
  },
});

export const findAccessCode = internalQuery({
  args: { codigo: v.string() },
  handler: async (ctx, args) => {
    const codigoNorm = args.codigo.trim().toUpperCase();
    const codeDoc = await ctx.db
      .query("accessCodes")
      .withIndex("by_codigo", (q) => q.eq("codigo", codigoNorm))
      .unique();

    if (!codeDoc || !codeDoc.activo) return null;

    // Verificar expiración
    if (codeDoc.fechaExpiracion && new Date(codeDoc.fechaExpiracion) < new Date()) {
      return null;
    }

    // Verificar usos
    if (codeDoc.usosMaximos !== undefined && codeDoc.usosActuales >= codeDoc.usosMaximos) {
      return null;
    }

    return codeDoc;
  },
});
