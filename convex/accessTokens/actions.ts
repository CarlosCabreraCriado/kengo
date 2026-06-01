"use node";

import { Resend } from "resend";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { accessLinkEmailTemplate } from "../email/templates";
import { Id } from "../_generated/dataModel";

function buildUrl(token: string): string {
  const appUrl = (process.env["APP_URL"] as string) || "https://kengoapp.com";
  return `${appUrl}/magic?t=${token}`;
}

export const sendByEmail = action({
  args: {
    userId: v.string(),
    /**
     * Clínica activa del fisio. Cuando se proporciona, valida estrictamente
     * contra esa clínica (regla multiclínica: la activa manda). Sin ella,
     * fallback al chequeo "any" para compatibilidad transitoria.
     */
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; emailEnviado: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    // Bloquea el envío del magic link según la regla multiclínica: si el
    // frontend pasa la clínica activa, validamos esa específicamente; en su
    // defecto, exigimos que el fisio tenga al menos una clínica operativa.
    if (args.clinicId) {
      await ctx.runQuery(
        internal.billing.internal.assertActiveSubscription,
        { clinicId: args.clinicId },
      );
    } else {
      await ctx.runQuery(
        internal.billing.internal.assertAnyActiveSubscriptionByExternalId,
        { externalId: identity.subject },
      );
    }

    const requester = await ctx.runQuery(internal.users.internal.getRequesterByExternalId, {
      externalId: identity.subject,
    });
    if (!requester) throw new Error("Usuario no encontrado");

    const target = await ctx.runQuery(internal.users.internal.resolveUser, {
      idOrUuid: args.userId,
    });
    if (!target) throw new Error("Usuario destinatario no encontrado");
    if (!target.email) throw new Error("El usuario no tiene email registrado");

    const { token, url } = await ctx.runMutation(
      internal.accessTokens.mutations.getOrCreateForUser,
      {
        pacienteId: target._id as Id<"users">,
        creadoPor: requester._id as Id<"users">,
      },
    );

    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return { ok: false, emailEnviado: false };
    }

    const nombre = target.firstName || target.email.split("@")[0] || "";
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: target.email,
      subject: `${nombre}, tu acceso a Kengo está listo`,
      html: accessLinkEmailTemplate(nombre, url),
    });

    if (error) {
      console.error("[Email] Error enviando access link:", error);
      throw new Error("Error al enviar el email");
    }

    // Señalar token usado para el remitente. buildUrl se usa indirectamente.
    void buildUrl(token);
    console.log(`[Email] Access link enviado a ${target.email}`);
    return { ok: true, emailEnviado: true };
  },
});
