import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

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

export const countRecentRecoveryCodes = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    const oneHourAgo = Date.now() - ONE_HOUR_MS;

    const codes = await ctx.db
      .query("recoveryCodes")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .collect();

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
      .collect();

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
      .collect();

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
      .collect();

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
