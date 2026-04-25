import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const insertUsersBatch = internalMutation({
  args: {
    users: v.array(
      v.object({
        legacyDirectusId: v.string(),
        email: v.string(),
        firstName: v.string(),
        lastName: v.string(),
        emailVerified: v.boolean(),
        telefono: v.optional(v.string()),
        direccion: v.optional(v.string()),
        postal: v.optional(v.string()),
        numeroColegiado: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const user of args.users) {
      // Check by email first
      const existingByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", user.email))
        .unique();

      if (existingByEmail) {
        if (!existingByEmail.legacyDirectusId) {
          await ctx.db.patch(existingByEmail._id, {
            legacyDirectusId: user.legacyDirectusId,
          });
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      // Check by legacyDirectusId
      const existingByLegacy = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", user.legacyDirectusId),
        )
        .unique();

      if (existingByLegacy) {
        skipped++;
        continue;
      }

      await ctx.db.insert("users", {
        externalId: user.legacyDirectusId,
        email: user.email,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        legacyDirectusId: user.legacyDirectusId,
        telefono: user.telefono,
        direccion: user.direccion,
        postal: user.postal,
        numeroColegiado: user.numeroColegiado,
      });
      created++;
    }

    return { created, updated, skipped };
  },
});
