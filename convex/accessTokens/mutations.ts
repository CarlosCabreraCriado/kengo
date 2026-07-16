import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import {
  checkClinicPermission,
  getAuthenticatedUser,
  requireActiveSubscription,
  requireAnyActiveSubscriptionForUser,
} from "../_helpers/permissions";
import { assertCanAccessPaciente } from "../_helpers/authorization";

function buildUrl(token: string): string {
  const appUrl = (process.env["APP_URL"] as string) || "https://kengoapp.com";
  return `${appUrl}/magic?t=${token}`;
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const create = mutation({
  args: {
    userId: v.id("users"),
    usosMaximos: v.optional(v.number()),
    diasExpiracion: v.optional(v.number()),
    /**
     * Clínica activa del fisio. Cuando se proporciona, valida estrictamente
     * contra esa clínica (regla multiclínica: la activa manda). Sin ella,
     * fallback a "any" para compatibilidad transitoria.
     */
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args) => {
    const requester = await getAuthenticatedUser(ctx);
    if (args.clinicId) {
      await checkClinicPermission(ctx, requester._id, args.clinicId, [
        "fisio",
        "admin",
      ]);
      await requireActiveSubscription(ctx, args.clinicId);
    } else {
      await requireAnyActiveSubscriptionForUser(ctx, requester._id);
    }
    // El magic link concede acceso a la sesión de `userId`. Exigimos que sea
    // un paciente que el solicitante gestiona; de lo contrario cualquier fisio
    // podría acuñar un enlace de login para un usuario arbitrario (ATO).
    await assertCanAccessPaciente(ctx, requester._id, args.userId);
    const targetId = args.userId;

    const token = randomToken();
    const fechaExpiracion = args.diasExpiracion
      ? new Date(
          Date.now() + args.diasExpiracion * 24 * 60 * 60 * 1000,
        ).toISOString()
      : undefined;

    const id = await ctx.db.insert("accessTokens", {
      userId: targetId,
      token,
      usosActuales: 0,
      usosMaximos: args.usosMaximos ?? undefined,
      fechaExpiracion,
      activo: true,
      creadoPor: requester._id,
    });

    return { id: id as string, url: buildUrl(token) };
  },
});

export const revoke = mutation({
  args: { id: v.id("accessTokens") },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedUser(ctx);
    const token = await ctx.db.get(args.id);
    if (!token) return { ok: true };
    // B-10: solo quien gestiona al paciente objetivo (o el propio paciente)
    // puede revocar su token de acceso.
    await assertCanAccessPaciente(ctx, actor._id, token.userId);
    await ctx.db.patch(args.id, { activo: false });
    return { ok: true };
  },
});

export const incrementUsage = internalMutation({
  args: { id: v.id("accessTokens") },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.id);
    if (!token) return;
    await ctx.db.patch(args.id, {
      usosActuales: token.usosActuales + 1,
      ultimoUso: new Date().toISOString(),
    });
  },
});

export const validateAndConsume = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tok = await ctx.db
      .query("accessTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!tok) return { valid: false, error: "TOKEN_NO_ENCONTRADO" as const };
    if (!tok.activo) return { valid: false, error: "TOKEN_REVOCADO" as const };
    if (
      tok.fechaExpiracion &&
      new Date(tok.fechaExpiracion) < new Date()
    ) {
      return { valid: false, error: "TOKEN_EXPIRADO" as const };
    }
    if (tok.usosMaximos && tok.usosActuales >= tok.usosMaximos) {
      return { valid: false, error: "TOKEN_AGOTADO" as const };
    }

    const user = await ctx.db.get(tok.userId);
    if (!user) return { valid: false, error: "USUARIO_NO_ENCONTRADO" as const };

    await ctx.db.patch(tok._id, {
      usosActuales: tok.usosActuales + 1,
      ultimoUso: new Date().toISOString(),
    });

    return {
      valid: true as const,
      email: user.email,
      userId: user._id as string,
      firstName: user.firstName,
    };
  },
});

export const getOrCreateForUser = internalMutation({
  args: {
    pacienteId: v.id("users"),
    creadoPor: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Punto único de acuñación para `sendByEmail` y el flujo de PDF: exigimos
    // que `creadoPor` gestione al paciente destinatario del magic link.
    await assertCanAccessPaciente(ctx, args.creadoPor, args.pacienteId);

    const existing = await ctx.db
      .query("accessTokens")
      .withIndex("by_userId", (q) => q.eq("userId", args.pacienteId))
      .collect();

    const now = new Date();
    const activo = existing.find(
      (t) =>
        t.activo &&
        (!t.fechaExpiracion || new Date(t.fechaExpiracion) > now),
    );
    if (activo) return { token: activo.token, url: buildUrl(activo.token) };

    const token = randomToken();
    const fechaExpiracion = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    await ctx.db.insert("accessTokens", {
      userId: args.pacienteId,
      token,
      usosActuales: 0,
      usosMaximos: undefined,
      fechaExpiracion,
      activo: true,
      creadoPor: args.creadoPor,
    });

    return { token, url: buildUrl(token) };
  },
});
