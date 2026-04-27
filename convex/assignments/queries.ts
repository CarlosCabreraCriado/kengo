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
    pacienteId: v.id("users"),
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db
      .query("assignments")
      .withIndex("by_pacienteId_clinicId", (q) =>
        q.eq("pacienteId", args.pacienteId).eq("clinicId", args.clinicId),
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
      fisioAvatar: fisio.avatar,
    };
  },
});
