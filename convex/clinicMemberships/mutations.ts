import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  getAuthenticatedUser,
  requireActiveSubscription,
} from "../_helpers/permissions";

const PUESTOS_FACTURABLES: ReadonlyArray<"fisio" | "admin"> = [
  "fisio",
  "admin",
] as const;

function esFacturable(puesto: "fisio" | "paciente" | "admin"): boolean {
  return (PUESTOS_FACTURABLES as ReadonlyArray<string>).includes(puesto);
}

/**
 * Añade una membresía usuario-clínica.
 */
export const add = mutation({
  args: {
    userId: v.id("users"),
    clinicId: v.id("clinics"),
    puesto: v.union(
      v.literal("fisio"),
      v.literal("paciente"),
      v.literal("admin"),
    ),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    // Solo bloquear el alta si el nuevo puesto es facturable. Pacientes
    // pueden seguir vinculándose aunque la clínica esté impagada.
    if (args.puesto === "fisio" || args.puesto === "admin") {
      await requireActiveSubscription(ctx, args.clinicId);
    }

    const existing = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", args.userId).eq("clinicId", args.clinicId),
      )
      .unique();

    let puestoAnterior: "fisio" | "paciente" | "admin" | null = null;
    let resultId;
    if (existing) {
      puestoAnterior = existing.puesto;
      if (existing.puesto !== args.puesto) {
        await ctx.db.patch(existing._id, { puesto: args.puesto });
      }
      resultId = existing._id;
    } else {
      resultId = await ctx.db.insert("clinicMemberships", {
        userId: args.userId,
        clinicId: args.clinicId,
        puesto: args.puesto,
      });
    }

    // Sync con Stripe si el puesto resultante o el anterior era facturable.
    if (esFacturable(args.puesto) || (puestoAnterior && esFacturable(puestoAnterior))) {
      await ctx.scheduler.runAfter(
        0,
        internal.billing.internal.syncQuantityFromMemberships,
        { clinicId: args.clinicId },
      );
    }

    return resultId;
  },
});

/**
 * Elimina una membresía por id.
 */
export const remove = mutation({
  args: { membershipId: v.id("clinicMemberships") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) return { ok: true };

    const eraFacturable = esFacturable(membership.puesto);
    const clinicId = membership.clinicId;

    await ctx.db.delete(args.membershipId);

    if (eraFacturable) {
      await ctx.scheduler.runAfter(
        0,
        internal.billing.internal.syncQuantityFromMemberships,
        { clinicId },
      );
    }

    return { ok: true };
  },
});
