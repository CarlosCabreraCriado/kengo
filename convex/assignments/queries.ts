import { v } from "convex/values";
import { query } from "../_generated/server";
import { batchGetMap } from "../_helpers/batchGet";

export const listByClinic = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .collect();

    const userIds = [
      ...assignments.map((a) => a.pacienteId),
      ...assignments.map((a) => a.fisioId),
    ];
    const usersMap = await batchGetMap(ctx, userIds);

    return assignments.map((a) => ({
      ...a,
      paciente: usersMap.get(a.pacienteId) ?? null,
      fisio: usersMap.get(a.fisioId) ?? null,
    }));
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
