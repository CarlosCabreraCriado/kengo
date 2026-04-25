"use node";

import { Resend } from "resend";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import {
  planPdfEmailTemplate,
  contactFormTemplate,
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
