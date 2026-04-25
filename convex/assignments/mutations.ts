import { v } from "convex/values";
import { mutation } from "../_generated/server";
import {
  getAuthenticatedUser,
  checkClinicPermission,
  PUESTO_FISIOTERAPEUTA,
  PUESTO_ADMINISTRADOR,
} from "../_helpers/permissions";

export const bulkAssign = mutation({
  args: {
    clinicId: v.id("clinics"),
    assignments: v.array(
      v.object({
        pacienteId: v.id("users"),
        fisioId: v.id("users"),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await checkClinicPermission(ctx, user._id, args.clinicId, [
      PUESTO_FISIOTERAPEUTA,
      PUESTO_ADMINISTRADOR,
    ]);

    // Remove existing assignments for this clinic
    const existing = await ctx.db
      .query("assignments")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .collect();

    for (const assignment of existing) {
      await ctx.db.delete(assignment._id);
    }

    // Insert new assignments
    for (const assignment of args.assignments) {
      await ctx.db.insert("assignments", {
        pacienteId: assignment.pacienteId,
        fisioId: assignment.fisioId,
        clinicId: args.clinicId,
      });
    }
  },
});

export const assign = mutation({
  args: {
    pacienteId: v.id("users"),
    fisioId: v.id("users"),
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, args) => {
    // Check if assignment already exists
    const existing = await ctx.db
      .query("assignments")
      .withIndex("by_pacienteId_clinicId", (q) =>
        q.eq("pacienteId", args.pacienteId).eq("clinicId", args.clinicId),
      )
      .unique();

    if (existing) {
      // Update fisio if different
      if (existing.fisioId !== args.fisioId) {
        await ctx.db.patch(existing._id, { fisioId: args.fisioId });
      }
    } else {
      await ctx.db.insert("assignments", {
        pacienteId: args.pacienteId,
        fisioId: args.fisioId,
        clinicId: args.clinicId,
      });
    }
  },
});
