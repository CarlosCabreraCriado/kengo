import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";

/**
 * Lista membresías de un usuario con datos de clínica anidados.
 */
export const listByUser = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const requester = await getAuthenticatedUser(ctx);
    const userId = args.userId ?? requester._id;

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const enriched = await Promise.all(
      memberships.map(async (m) => {
        const clinic = await ctx.db.get(m.clinicId);
        return {
          _id: m._id,
          userId,
          clinicId: m.clinicId,
          puesto: m.puesto,
          nombreClinica: clinic?.nombre ?? null,
        };
      }),
    );

    return enriched;
  },
});
