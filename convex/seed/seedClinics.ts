import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export const insertClinicsBatch = internalMutation({
  args: {
    clinics: v.array(
      v.object({
        legacyId: v.number(),
        nombre: v.string(),
        telefono: v.optional(v.string()),
        email: v.optional(v.string()),
        direccion: v.optional(v.string()),
        postal: v.optional(v.string()),
        nif: v.optional(v.string()),
        colorPrimario: v.optional(v.string()),
        colorSecundario: v.optional(v.string()),
        creatorLegacyId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;

    for (const clinic of args.clinics) {
      const existing = await ctx.db
        .query("clinics")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", clinic.legacyId))
        .unique();

      if (existing) {
        skipped++;
        continue;
      }

      let createdBy: Id<"users"> | undefined;
      if (clinic.creatorLegacyId) {
        const creator = await ctx.db
          .query("users")
          .withIndex("by_legacyDirectusId", (q) =>
            q.eq("legacyDirectusId", clinic.creatorLegacyId),
          )
          .unique();
        createdBy = creator?._id;
      }

      if (!createdBy) {
        const anyUser = await ctx.db.query("users").first();
        createdBy = anyUser?._id;
      }

      if (!createdBy) {
        console.warn(`No se pudo resolver creador para clinica ${clinic.nombre}`);
        continue;
      }

      await ctx.db.insert("clinics", {
        nombre: clinic.nombre,
        telefono: clinic.telefono,
        email: clinic.email,
        direccion: clinic.direccion,
        postal: clinic.postal,
        nif: clinic.nif,
        colorPrimario: clinic.colorPrimario,
        colorSecundario: clinic.colorSecundario,
        createdBy,
        legacyId: clinic.legacyId,
      });
      created++;
    }

    return { created, skipped };
  },
});
