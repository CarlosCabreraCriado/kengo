import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  checkClinicPermission,
  requireActiveSubscription,
  tieneGestion,
} from "../_helpers/permissions";
import { membershipEsPaciente } from "../_helpers/patientAccess";
import { planAssignmentDiff } from "./_helpers";

export const bulkAssign = mutation({
  args: {
    clinicId: v.id("clinics"),
    assignments: v.array(
      v.object({
        pacienteId: v.id("users"),
        // `null` = quitar la asignación de ese paciente. Antes la baja se
        // conseguía por efecto colateral (se borraba la clínica entera y el
        // paciente simplemente no se reinsertaba); ahora es explícita.
        fisioId: v.union(v.id("users"), v.null()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await checkClinicPermission(ctx, user._id, args.clinicId, [
      "fisio",
      "admin",
    ]);
    await requireActiveSubscription(ctx, args.clinicId);

    // Una sola lectura de las membresías de la clínica para validar todas las
    // entradas del payload: el paciente debe serlo de esta clínica y el fisio
    // debe tener gestión en ella. `bulkAssign` no validaba ninguna de las dos.
    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .collect();
    const membershipPorUsuario = new Map<
      Id<"users">,
      Doc<"clinicMemberships">
    >();
    for (const m of memberships) membershipPorUsuario.set(m.userId, m);

    for (const entry of args.assignments) {
      if (!membershipEsPaciente(membershipPorUsuario.get(entry.pacienteId) ?? null)) {
        throw new Error(
          "Alguno de los pacientes no pertenece a la clínica seleccionada.",
        );
      }
      if (entry.fisioId === null) continue;
      const fisioMembership = membershipPorUsuario.get(entry.fisioId);
      if (!fisioMembership || !tieneGestion(fisioMembership.puesto)) {
        throw new Error(
          "Alguno de los responsables no es fisio o admin de la clínica.",
        );
      }
    }

    const existing = await ctx.db
      .query("assignments")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .collect();

    const { ops, asignadas, eliminadas } = planAssignmentDiff(
      existing,
      args.assignments,
    );

    for (const op of ops) {
      if (op.kind === "delete") {
        await ctx.db.delete(op.assignmentId as Id<"assignments">);
      } else if (op.kind === "patch") {
        await ctx.db.patch(op.assignmentId as Id<"assignments">, {
          fisioId: op.fisioId as Id<"users">,
        });
      } else {
        await ctx.db.insert("assignments", {
          pacienteId: op.pacienteId as Id<"users">,
          fisioId: op.fisioId as Id<"users">,
          clinicId: args.clinicId,
        });
      }
    }

    return { asignadas, eliminadas };
  },
});

export const assign = mutation({
  args: {
    pacienteId: v.id("users"),
    fisioId: v.id("users"),
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await checkClinicPermission(ctx, user._id, args.clinicId, [
      "fisio",
      "admin",
    ]);
    await requireActiveSubscription(ctx, args.clinicId);

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
