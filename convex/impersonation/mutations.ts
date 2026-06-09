/**
 * Mutations de auditoría de impersonación.
 *
 * La impersonación real la ejecuta Better-Auth (plugin admin) desde el cliente;
 * estas mutations solo registran la bitácora consultable en `impersonationAudit`.
 * El registro nativo de la sesión (`session.impersonatedBy`) es el backstop
 * autoritativo; esto es trazabilidad de apoyo.
 *
 * Gating: ambas mutations exigen que el caller esté en la allowlist
 * `SUPPORT_USER_IDS`. Se invocan mientras el técnico está autenticado COMO
 * técnico (logStart antes de impersonar, logStop tras salir), por lo que
 * `identity.subject` es el externalId del técnico.
 */

import { v } from "convex/values";
import { mutation, type MutationCtx } from "../_generated/server";
import { isSupportTechnician } from "../_helpers/support";

async function findUserByExternalId(ctx: MutationCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
    .unique();
}

async function logEvent(
  ctx: MutationCtx,
  action: "start" | "stop",
  targetExternalId: string,
  reason: string | undefined,
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("No autenticado");
  if (!isSupportTechnician(identity.subject)) {
    throw new Error("No autorizado: no eres técnico de soporte");
  }

  const tech = await findUserByExternalId(ctx, identity.subject);
  const target = await findUserByExternalId(ctx, targetExternalId);

  await ctx.db.insert("impersonationAudit", {
    technicianExternalId: identity.subject,
    technicianEmail: tech?.email,
    targetExternalId,
    targetEmail: target?.email,
    action,
    reason,
    createdAt: Date.now(),
  });
}

/** Registra el INICIO de una impersonación. Llamar antes de `impersonateUser`. */
export const logStart = mutation({
  args: { targetExternalId: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await logEvent(ctx, "start", args.targetExternalId, args.reason);
  },
});

/** Registra el FIN de una impersonación. Llamar tras `stopImpersonating`. */
export const logStop = mutation({
  args: { targetExternalId: v.string() },
  handler: async (ctx, args) => {
    await logEvent(ctx, "stop", args.targetExternalId, undefined);
  },
});
