import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const insertAssignmentsBatch = internalMutation({
  args: {
    assignments: v.array(
      v.object({
        pacienteLegacyId: v.string(),
        fisioLegacyId: v.string(),
        clinicLegacyId: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;
    let notFound = 0;

    for (const a of args.assignments) {
      const paciente = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", a.pacienteLegacyId),
        )
        .unique();

      if (!paciente) {
        notFound++;
        continue;
      }

      const fisio = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", a.fisioLegacyId),
        )
        .unique();

      if (!fisio) {
        notFound++;
        continue;
      }

      const clinic = await ctx.db
        .query("clinics")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", a.clinicLegacyId))
        .unique();

      if (!clinic) {
        notFound++;
        continue;
      }

      const existing = await ctx.db
        .query("assignments")
        .withIndex("by_pacienteId_clinicId", (q) =>
          q.eq("pacienteId", paciente._id).eq("clinicId", clinic._id),
        )
        .unique();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("assignments", {
        pacienteId: paciente._id,
        fisioId: fisio._id,
        clinicId: clinic._id,
      });
      created++;
    }

    return { created, skipped, notFound };
  },
});
