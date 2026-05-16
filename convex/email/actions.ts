"use node";

import { Resend } from "resend";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import {
  planPdfEmailTemplate,
  contactFormTemplate,
  trialEndingTemplate,
  paymentFailedTemplate,
  migrationAnnouncementTemplate,
  enterpriseInvitationTemplate,
  patientInvitationTemplate,
  therapistInvitationTemplate,
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
      subject: `Tu trial de Kengo termina pronto - ${args.clinicaNombre}`,
      html: trialEndingTemplate(
        args.nombreAdmin,
        args.clinicaNombre,
        args.diasRestantes,
        args.portalUrl,
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
      subject: `Hay un problema con el pago - ${args.clinicaNombre}`,
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
      subject: `Plan a medida para ${args.clinicaNombre} (+10 fisios)`,
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
