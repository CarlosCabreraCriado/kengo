import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";

export const myClinicsList = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const clinics = await Promise.all(
      memberships.map(async (m) => {
        const clinic = await ctx.db.get(m.clinicId);
        return clinic ? { ...clinic, puesto: m.puesto } : null;
      }),
    );

    return clinics.filter(
      (c): c is NonNullable<typeof c> => c !== null,
    );
  },
});

export const getMembers = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return user ? { ...user, puesto: m.puesto } : null;
      }),
    );

    return members.filter(
      (m): m is NonNullable<typeof m> => m !== null,
    );
  },
});
