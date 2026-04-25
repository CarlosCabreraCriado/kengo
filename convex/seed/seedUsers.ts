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

    const isEmpty = (v: string | undefined | null) =>
      v === undefined || v === null || v.trim() === "";

    type UserPatch = {
      legacyDirectusId?: string;
      telefono?: string;
      direccion?: string;
      postal?: string;
      numeroColegiado?: string;
    };

    for (const user of args.users) {
      const buildPatch = (existing: { legacyDirectusId?: string }): UserPatch => {
        const patch: UserPatch = {};
        if (!existing.legacyDirectusId)
          patch.legacyDirectusId = user.legacyDirectusId;
        if (!isEmpty(user.telefono)) patch.telefono = user.telefono;
        if (!isEmpty(user.direccion)) patch.direccion = user.direccion;
        if (!isEmpty(user.postal)) patch.postal = user.postal;
        if (!isEmpty(user.numeroColegiado))
          patch.numeroColegiado = user.numeroColegiado;
        return patch;
      };

      // Check by email first
      const existingByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", user.email))
        .unique();

      if (existingByEmail) {
        const patch = buildPatch(existingByEmail);
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existingByEmail._id, patch);
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
        const patch = buildPatch(existingByLegacy);
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existingByLegacy._id, patch);
          updated++;
        } else {
          skipped++;
        }
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
