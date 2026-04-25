import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const insertAccessCodesBatch = internalMutation({
  args: {
    codes: v.array(
      v.object({
        clinicLegacyId: v.number(),
        codigo: v.string(),
        tipo: v.union(v.literal("fisioterapeuta"), v.literal("paciente")),
        activo: v.boolean(),
        usosMaximos: v.optional(v.number()),
        usosActuales: v.number(),
        fechaExpiracion: v.optional(v.string()),
        email: v.optional(v.string()),
        creadorLegacyId: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;
    let notFound = 0;

    for (const code of args.codes) {
      const existing = await ctx.db
        .query("accessCodes")
        .withIndex("by_codigo", (q) => q.eq("codigo", code.codigo))
        .unique();

      if (existing) {
        skipped++;
        continue;
      }

      const clinic = await ctx.db
        .query("clinics")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", code.clinicLegacyId))
        .unique();

      if (!clinic) {
        notFound++;
        continue;
      }

      const creator = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", code.creadorLegacyId),
        )
        .unique();

      if (!creator) {
        notFound++;
        continue;
      }

      await ctx.db.insert("accessCodes", {
        clinicId: clinic._id,
        codigo: code.codigo,
        tipo: code.tipo,
        activo: code.activo,
        usosMaximos: code.usosMaximos,
        usosActuales: code.usosActuales,
        fechaExpiracion: code.fechaExpiracion,
        email: code.email,
        creadoPor: creator._id,
      });
      created++;
    }

    return { created, skipped, notFound };
  },
});
