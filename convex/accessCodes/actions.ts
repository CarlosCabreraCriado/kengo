"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Genera un código de acceso y, si el tipo es `fisioterapeuta`, dispara el
 * email de invitación al destinatario. Wrapper de `accessCodes.mutations.create`
 * + `email.actions.sendTherapistInvitationEmail`.
 *
 * La mutation hace todas las validaciones (permisos, suscripción, límite de
 * fisios, etc.). El envío de email es fire-and-forget en cuanto a errores
 * (un fallo de Resend NO aborta la creación del código).
 */
export const createAndInvite = action({
  args: {
    clinicId: v.id("clinics"),
    tipo: v.union(v.literal("fisioterapeuta"), v.literal("paciente")),
    email: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ codigo: string; emailEnviado: boolean }> => {
    const { codigo } = await ctx.runMutation(api.accessCodes.mutations.create, {
      clinicId: args.clinicId,
      tipo: args.tipo,
      email: args.email,
    });

    let emailEnviado = false;
    if (args.tipo === "fisioterapeuta" && args.email) {
      try {
        const clinica = await ctx.runQuery(
          internal.clinics.internal.getById,
          { clinicId: args.clinicId as Id<"clinics"> },
        );
        const nombreClinica = clinica?.nombre ?? "tu clínica";

        const identity = await ctx.auth.getUserIdentity();
        const requester = identity
          ? await ctx.runQuery(
              internal.users.internal.getRequesterByExternalId,
              { externalId: identity.subject },
            )
          : null;
        const nombreColega = requester
          ? `${requester.firstName ?? ""} ${requester.lastName ?? ""}`.trim()
          : "";

        const appUrl =
          (process.env["APP_URL"] as string) || "https://kengoapp.com";
        const invitacionUrl =
          `${appUrl}/invitacion?codigo=${codigo}` +
          `&email=${encodeURIComponent(args.email)}`;

        emailEnviado = await ctx.runAction(
          internal.email.actions.sendTherapistInvitationEmail,
          {
            to: args.email,
            nombreColega: nombreColega || undefined,
            nombreClinica,
            invitacionUrl,
            codigo,
          },
        );
      } catch (err) {
        console.warn(
          "[accessCodes.createAndInvite] envío de email falló:",
          err,
        );
      }
    }

    return { codigo, emailEnviado };
  },
});
