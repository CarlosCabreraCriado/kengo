import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";

/**
 * Añade una membresía usuario-clínica.
 */
export const add = mutation({
  args: {
    userId: v.optional(v.id("users")),
    userLegacyId: v.optional(v.string()),
    clinicId: v.optional(v.id("clinics")),
    clinicLegacyId: v.optional(v.number()),
    puesto: v.number(),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    let userId: Id<"users"> | null = args.userId ?? null;
    if (!userId && args.userLegacyId) {
      const u = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", args.userLegacyId!),
        )
        .unique();
      userId = u?._id ?? null;
    }
    if (!userId) throw new Error("Usuario no encontrado");

    let clinicId: Id<"clinics"> | null = args.clinicId ?? null;
    if (!clinicId && args.clinicLegacyId !== undefined) {
      const c = await ctx.db
        .query("clinics")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", args.clinicLegacyId))
        .unique();
      clinicId = c?._id ?? null;
    }
    if (!clinicId) throw new Error("Clínica no encontrada");

    // Idempotente: si ya existe, devolverlo
    const existing = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", userId!).eq("clinicId", clinicId!),
      )
      .unique();

    if (existing) {
      if (existing.puesto !== args.puesto) {
        await ctx.db.patch(existing._id, { puesto: args.puesto });
      }
      return existing._id;
    }

    return await ctx.db.insert("clinicMemberships", {
      userId,
      clinicId,
      puesto: args.puesto,
    });
  },
});

/**
 * Elimina una membresía por id.
 */
export const remove = mutation({
  args: { membershipId: v.id("clinicMemberships") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    await ctx.db.delete(args.membershipId);
    return { ok: true };
  },
});
