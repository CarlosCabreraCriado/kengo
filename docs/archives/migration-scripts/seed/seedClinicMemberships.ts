import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const insertMembershipsBatch = internalMutation({
  args: {
    memberships: v.array(
      v.object({
        userLegacyId: v.string(),
        clinicLegacyId: v.number(),
        puesto: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;
    let notFound = 0;

    for (const m of args.memberships) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", m.userLegacyId),
        )
        .unique();

      if (!user) {
        notFound++;
        continue;
      }

      const clinic = await ctx.db
        .query("clinics")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", m.clinicLegacyId))
        .unique();

      if (!clinic) {
        notFound++;
        continue;
      }

      const existing = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_userId_clinicId", (q) =>
          q.eq("userId", user._id).eq("clinicId", clinic._id),
        )
        .unique();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("clinicMemberships", {
        userId: user._id,
        clinicId: clinic._id,
        puesto: m.puesto,
      });
      created++;
    }

    return { created, skipped, notFound };
  },
});
