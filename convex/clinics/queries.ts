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
        const [clinic, files] = await Promise.all([
          ctx.db.get(m.clinicId),
          ctx.db
            .query("clinicFiles")
            .withIndex("by_clinicId", (q) => q.eq("clinicId", m.clinicId))
            .collect(),
        ]);
        if (!clinic) return null;
        const imagenes = files.map((f) => ({ id: f._id, fileId: f.fileId }));
        return { ...clinic, puesto: m.puesto, imagenes };
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

    const users = await Promise.all(
      memberships.map((m) => ctx.db.get(m.userId)),
    );

    return memberships
      .map((m, i) => {
        const user = users[i];
        return user ? { ...user, puesto: m.puesto } : null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  },
});
