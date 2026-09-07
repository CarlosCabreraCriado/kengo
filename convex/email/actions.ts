"use node";

import { Resend } from "resend";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import {
  planPdfEmailTemplate,
  contactFormTemplate,
  trialEndingTemplate,
  paymentFailedTemplate,
  welcomeAfterCheckoutTemplate,
  subscriptionCanceledTemplate,
  migrationAnnouncementTemplate,
  enterpriseInvitationTemplate,
  patientInvitationTemplate,
  therapistInvitationTemplate,
  paymentMethodRemovedTemplate,
  ownershipTransferredNewOwnerTemplate,
  ownershipTransferredPreviousOwnerTemplate,
} from "./templates";

export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }

    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.to,
      subject: args.subject,
      html: args.html,
    });

    if (error) {
      console.error("[Email] Error enviando email:", error);
      return false;
    }

    console.log(`[Email] Email enviado a ${args.to}: ${args.subject}`);
    return true;
  },
});

export const sendPlanPdfEmail = internalAction({
  args: {
    email: v.string(),
    storageId: v.id("_storage"),
    filename: v.string(),
    nombrePaciente: v.string(),
    nombreFisio: v.string(),
    tituloPlan: v.string(),
    nombreClinica: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      console.error("[Email] PDF no encontrado en storage:", args.storageId);
      return false;
    }
    const pdfBuffer = Buffer.from(await blob.arrayBuffer());

    const appUrl = process.env["APP_URL"] || "https://kengoapp.com";
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.email,
      subject: `Tu plan de tratamiento: ${args.tituloPlan} - Kengo`,
      html: planPdfEmailTemplate(
        args.nombrePaciente,
        args.nombreFisio,
        args.tituloPlan,
        args.nombreClinica,
        appUrl,
      ),
      attachments: [{ filename: args.filename, content: pdfBuffer }],
    });

    if (error) {
      console.error("[Email] Error enviando PDF por email:", error);
      return false;
    }

    console.log(`[Email] PDF del plan enviado a ${args.email}`);
    return true;
  },
});

export const sendTrialEndingEmail = internalAction({
  args: {
    to: v.string(),
    nombreAdmin: v.string(),
    clinicaNombre: v.string(),
    diasRestantes: v.number(),
    /** Con tarjeta guardada el email es un recordatorio del primer cargo. */
    tieneMetodoPago: v.optional(v.boolean()),
    /** Fin del trial en ms, para decir la fecha exacta del primer cargo. */
    trialEnd: v.optional(v.number()),
    portalUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.to,
      subject: args.tieneMetodoPago
        ? `[Kengo · ${args.clinicaNombre}] Tu periodo de prueba termina pronto: primer cargo`
        : `[Kengo · ${args.clinicaNombre}] Tu periodo de prueba termina pronto`,
      html: trialEndingTemplate(
        args.nombreAdmin,
        args.clinicaNombre,
        args.diasRestantes,
        args.portalUrl,
        { tieneMetodoPago: args.tieneMetodoPago ?? false, trialEnd: args.trialEnd },
      ),
    });

    if (error) {
      console.error("[Email] Error enviando trial-ending:", error);
      return false;
    }
    console.log(`[Email] Trial-ending enviado a ${args.to}`);
    return true;
  },
});

export const sendPaymentFailedEmail = internalAction({
  args: {
    to: v.string(),
    nombreAdmin: v.string(),
    clinicaNombre: v.string(),
    portalUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.to,
      subject: `[Kengo · ${args.clinicaNombre}] Hay un problema con el pago`,
      html: paymentFailedTemplate(
        args.nombreAdmin,
        args.clinicaNombre,
        args.portalUrl,
      ),
    });

    if (error) {
      console.error("[Email] Error enviando payment-failed:", error);
      return false;
    }
    console.log(`[Email] Payment-failed enviado a ${args.to}`);
    return true;
  },
});

export const sendWelcomeAfterCheckoutEmail = internalAction({
  args: {
    to: v.string(),
    nombreAdmin: v.string(),
    clinicaNombre: v.string(),
    /**
     * Fin del trial en ms cuando la tarjeta se guardó durante la prueba: la
     * suscripción aún no cobra y el email debe decir cuándo lo hará.
     */
    trialEnd: v.optional(v.number()),
    portalUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.to,
      subject: args.trialEnd
        ? `[Kengo · ${args.clinicaNombre}] Método de pago guardado`
        : `[Kengo · ${args.clinicaNombre}] Tu suscripción está activa`,
      html: welcomeAfterCheckoutTemplate(
        args.nombreAdmin,
        args.clinicaNombre,
        args.portalUrl,
        args.trialEnd,
      ),
    });

    if (error) {
      console.error("[Email] Error enviando welcome-after-checkout:", error);
      return false;
    }
    console.log(`[Email] welcome-after-checkout enviado a ${args.to}`);
    return true;
  },
});

export const sendSubscriptionCanceledEmail = internalAction({
  args: {
    to: v.string(),
    nombreAdmin: v.string(),
    clinicaNombre: v.string(),
    reactivateUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.to,
      subject: `[Kengo · ${args.clinicaNombre}] Suscripción cancelada`,
      html: subscriptionCanceledTemplate(
        args.nombreAdmin,
        args.clinicaNombre,
        args.reactivateUrl,
      ),
    });

    if (error) {
      console.error("[Email] Error enviando subscription-canceled:", error);
      return false;
    }
    console.log(`[Email] subscription-canceled enviado a ${args.to}`);
    return true;
  },
});

export const sendMigrationAnnouncementEmail = internalAction({
  args: {
    to: v.string(),
    nombreAdmin: v.string(),
    clinicaNombre: v.string(),
    diasGracia: v.number(),
    portalUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.to,
      subject: `Hemos lanzado planes de suscripción - ${args.clinicaNombre}`,
      html: migrationAnnouncementTemplate(
        args.nombreAdmin,
        args.clinicaNombre,
        args.diasGracia,
        args.portalUrl,
      ),
    });

    if (error) {
      console.error("[Email] Error enviando migration-announcement:", error);
      return false;
    }
    console.log(`[Email] Migration announcement enviado a ${args.to}`);
    return true;
  },
});

export const sendEnterpriseInvitationEmail = internalAction({
  args: {
    to: v.string(),
    nombreAdmin: v.string(),
    clinicaNombre: v.string(),
    fisiosActuales: v.number(),
    contactUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.to,
      subject: `Plan a medida para ${args.clinicaNombre} (+9 fisios)`,
      html: enterpriseInvitationTemplate(
        args.nombreAdmin,
        args.clinicaNombre,
        args.fisiosActuales,
        args.contactUrl,
      ),
    });

    if (error) {
      console.error("[Email] Error enviando enterprise-invitation:", error);
      return false;
    }
    console.log(`[Email] Enterprise invitation enviado a ${args.to}`);
    return true;
  },
});

export const sendTherapistInvitationEmail = internalAction({
  args: {
    to: v.string(),
    nombreColega: v.optional(v.string()),
    nombreClinica: v.string(),
    invitacionUrl: v.string(),
    codigo: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.to,
      subject: `Te han invitado a unirte a ${args.nombreClinica} en Kengo`,
      html: therapistInvitationTemplate(
        args.nombreColega ?? null,
        args.nombreClinica,
        args.invitacionUrl,
        args.codigo,
      ),
    });

    if (error) {
      console.error("[Email] Error enviando invitación de fisio:", error);
      return false;
    }
    console.log(`[Email] Invitación de fisio enviada a ${args.to}`);
    return true;
  },
});

export const sendPatientInvitationEmail = internalAction({
  args: {
    to: v.string(),
    nombre: v.string(),
    accessUrl: v.string(),
    codigo: v.string(),
    nombreFisio: v.optional(v.string()),
    nombreClinica: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.to,
      subject: "Tu invitación a Kengo",
      html: patientInvitationTemplate(
        args.nombre,
        args.accessUrl,
        args.codigo,
        args.nombreFisio ?? null,
        args.nombreClinica ?? null,
      ),
    });

    if (error) {
      console.error("[Email] Error enviando invitación de paciente:", error);
      return false;
    }
    console.log(`[Email] Invitación de paciente enviada a ${args.to}`);
    return true;
  },
});

export const sendContactForm = internalAction({
  args: {
    nombre: v.string(),
    email: v.string(),
    asunto: v.string(),
    mensaje: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }

    const contactEmails = (
      process.env["CONTACT_EMAILS"] || "info@kengoapp.com"
    )
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from: "Kengo Contacto <noreply@kengoapp.com>",
      to: contactEmails,
      replyTo: args.email,
      subject: `[Contacto Web] ${args.asunto}`,
      html: contactFormTemplate(
        args.nombre,
        args.email,
        args.asunto,
        args.mensaje,
      ),
    });

    if (error) {
      console.error("[Email] Error enviando email de contacto:", error);
      return false;
    }

    console.log(`[Email] Email de contacto enviado desde ${args.email}`);
    return true;
  },
});

const tarjetaArgs = v.object({
  marca: v.optional(v.string()),
  ultimos4: v.optional(v.string()),
});

export const sendPaymentMethodRemovedEmail = internalAction({
  args: {
    to: v.string(),
    nombreOwner: v.string(),
    clinicaNombre: v.string(),
    retiradaPorNombre: v.string(),
    tarjeta: tarjetaArgs,
    proximoCobro: v.optional(v.number()),
    portalUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.to,
      subject: `[Kengo · ${args.clinicaNombre}] Hace falta un método de pago nuevo`,
      html: paymentMethodRemovedTemplate(args),
    });
    if (error) {
      console.error("[Email] Error enviando payment-method-removed:", error);
      return false;
    }
    console.log(`[Email] Payment-method-removed enviado a ${args.to}`);
    return true;
  },
});

export const sendOwnershipTransferredEmails = internalAction({
  args: {
    clinicaNombre: v.string(),
    nuevo: v.object({ to: v.string(), nombre: v.string() }),
    anterior: v.optional(v.object({ to: v.string(), nombre: v.string() })),
    tarjetaRetirada: v.boolean(),
    hayTarjetaActiva: v.boolean(),
    teniaTarjeta: v.boolean(),
    proximoCobro: v.optional(v.number()),
    portalUrl: v.string(),
    cuentaUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      console.warn("[Email] RESEND_API_KEY no configurada, omitiendo envío");
      return false;
    }
    const resend = new Resend(apiKey);
    const nombreAnterior = args.anterior?.nombre ?? "El propietario anterior";

    const nuevo = await resend.emails.send({
      from: "Kengo <noreply@kengoapp.com>",
      to: args.nuevo.to,
      subject: `[Kengo · ${args.clinicaNombre}] Ahora eres el propietario de la clínica`,
      html: ownershipTransferredNewOwnerTemplate({
        nombreNuevo: args.nuevo.nombre,
        nombreAnterior,
        clinicaNombre: args.clinicaNombre,
        tarjetaRetirada: args.tarjetaRetirada,
        hayTarjetaActiva: args.hayTarjetaActiva,
        proximoCobro: args.proximoCobro,
        portalUrl: args.portalUrl,
      }),
    });
    if (nuevo.error) {
      console.error("[Email] Error enviando ownership-transferred (nuevo):", nuevo.error);
    }

    if (args.anterior) {
      const anterior = await resend.emails.send({
        from: "Kengo <noreply@kengoapp.com>",
        to: args.anterior.to,
        subject: `[Kengo · ${args.clinicaNombre}] Has transferido la propiedad de la clínica`,
        html: ownershipTransferredPreviousOwnerTemplate({
          nombreAnterior: args.anterior.nombre,
          nombreNuevo: args.nuevo.nombre,
          clinicaNombre: args.clinicaNombre,
          tarjetaRetirada: args.tarjetaRetirada,
          teniaTarjeta: args.teniaTarjeta,
          cuentaUrl: args.cuentaUrl,
        }),
      });
      if (anterior.error) {
        console.error("[Email] Error enviando ownership-transferred (anterior):", anterior.error);
      }
    }
    console.log(`[Email] Ownership-transferred enviado (${args.clinicaNombre})`);
    return !nuevo.error;
  },
});
