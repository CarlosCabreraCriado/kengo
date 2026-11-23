"use node";

import { v } from "convex/values";
import { action, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { buildPdfBuffer, EjercicioPdf, PlanPdfData } from "./render";

interface PdfGenerationResult {
  storageId: Id<"_storage">;
  url: string | null;
  filename: string;
  data: Awaited<
    ReturnType<
      typeof internal.pdf.internal.getPlanDataForPdf extends any
        ? any
        : any
    >
  >;
}

async function generatePlanPdfInternal(
  ctx: ActionCtx,
  planId: Id<"plans">,
): Promise<{
  storageId: Id<"_storage">;
  url: string | null;
  filename: string;
  paciente: { firstName: string; lastName: string; email: string };
  fisio: { firstName: string; lastName: string };
  plan: { titulo: string };
  clinica: { nombre: string };
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("No autenticado");

  const data = await ctx.runQuery(internal.pdf.internal.getPlanDataForPdf, {
    planId,
    requesterExternalId: identity.subject,
  });

  const tokenResult: { token: string; url: string } = await ctx.runMutation(
    internal.accessTokens.mutations.getOrCreateForUser,
    {
      pacienteId: data.paciente.id as Id<"users">,
      creadoPor: data.requester._id as Id<"users">,
    },
  );

  const fullData: PlanPdfData = {
    plan: data.plan,
    ejercicios: data.ejercicios as EjercicioPdf[],
    clinica: data.clinica,
    paciente: data.paciente,
    fisio: data.fisio,
    magicLinkUrl: tokenResult.url,
  };

  const pdfBuffer = await buildPdfBuffer(fullData);

  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  const storageId = await ctx.storage.store(blob);
  const url = await ctx.storage.getUrl(storageId);

  const lastNameSafe = data.paciente.last_name.replace(/[^\w\-]/g, "_");
  const filename = `plan_${data.plan.id}_${lastNameSafe}.pdf`;

  return {
    storageId,
    url,
    filename,
    paciente: {
      firstName: data.paciente.first_name,
      lastName: data.paciente.last_name,
      email: data.paciente.email,
    },
    fisio: {
      firstName: data.fisio.first_name,
      lastName: data.fisio.last_name,
    },
    plan: { titulo: data.plan.titulo },
    clinica: { nombre: data.clinica.nombre },
  };
}

export const generatePlanPdf = action({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    // B-12: gatear igual que `generateAndSendPlanPdf`. La generación del PDF
    // también acuña un magic link (getOrCreateForUser) y es acción de fisio, así
    // que un fisio con la clínica suspendida no debe poder generarlo.
    await ctx.runQuery(
      internal.billing.internal.assertActiveSubscriptionByPlanId,
      { planId: args.planId },
    );
    return await generatePlanPdfInternal(ctx, args.planId);
  },
});

export const generateAndSendPlanPdf = action({
  args: {
    planId: v.id("plans"),
    email: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; url: string | null }> => {
    // Bloquea el envío si la suscripción de la clínica del plan no está activa.
    await ctx.runQuery(
      internal.billing.internal.assertActiveSubscriptionByPlanId,
      { planId: args.planId },
    );
    const result = await generatePlanPdfInternal(ctx, args.planId);

    const sent: boolean = await ctx.runAction(
      internal.email.actions.sendPlanPdfEmail,
      {
        email: args.email,
        storageId: result.storageId,
        filename: result.filename,
        nombrePaciente: `${result.paciente.firstName} ${result.paciente.lastName}`,
        nombreFisio: `${result.fisio.firstName} ${result.fisio.lastName}`,
        tituloPlan: result.plan.titulo,
        nombreClinica: result.clinica.nombre,
      },
    );

    return { ok: sent, url: result.url };
  },
});
