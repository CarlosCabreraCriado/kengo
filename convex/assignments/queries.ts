import { v } from "convex/values";
import { query } from "../_generated/server";

export const listByClinic = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .collect();

    return await Promise.all(
      assignments.map(async (a) => {
        const paciente = await ctx.db.get(a.pacienteId);
        const fisio = await ctx.db.get(a.fisioId);
        return {
          ...a,
          paciente,
          fisio,
        };
      }),
    );
  },
});

export const getFisioResponsable = query({
  args: {
    pacienteId: v.optional(v.id("users")),
    clinicId: v.optional(v.id("clinics")),
    pacienteLegacyId: v.optional(v.string()),
    clinicLegacyId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Resolve paciente ID (Convex ID or legacy Directus UUID)
    let pacienteId = args.pacienteId;
    if (!pacienteId && args.pacienteLegacyId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", args.pacienteLegacyId),
        )
        .unique();
      if (!user) return null;
      pacienteId = user._id;
    }

    // Resolve clinic ID (Convex ID or legacy numeric ID)
    let clinicId = args.clinicId;
    if (!clinicId && args.clinicLegacyId !== undefined) {
      const clinic = await ctx.db
        .query("clinics")
        .withIndex("by_legacyId", (q) =>
          q.eq("legacyId", args.clinicLegacyId),
        )
        .unique();
      if (!clinic) return null;
      clinicId = clinic._id;
    }

    if (!pacienteId || !clinicId) return null;

    const assignment = await ctx.db
      .query("assignments")
      .withIndex("by_pacienteId_clinicId", (q) =>
        q.eq("pacienteId", pacienteId!).eq("clinicId", clinicId!),
      )
      .unique();

    if (!assignment) return null;

    const fisio = await ctx.db.get(assignment.fisioId);
    if (!fisio) return null;

    return {
      _id: assignment._id,
      pacienteId: assignment.pacienteId,
      fisioId: assignment.fisioId,
      clinicId: assignment.clinicId,
      _creationTime: assignment._creationTime,
      fisioNombre: fisio.firstName,
      fisioApellido: fisio.lastName,
      fisioEmail: fisio.email,
      fisioLegacyId: fisio.legacyDirectusId,
      fisioAvatar: fisio.avatar,
    };
  },
});
