import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";

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

    const existing = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", args.userId).eq("clinicId", args.clinicId),
      )
      .unique();

    if (existing) {
      if (existing.puesto !== args.puesto) {
        await ctx.db.patch(existing._id, { puesto: args.puesto });
      }
      return existing._id;
    }

    return await ctx.db.insert("clinicMemberships", {
      userId: args.userId,
      clinicId: args.clinicId,
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
