import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import {
  assertFisioInClinic,
  getManagedClinicIds,
} from "../_helpers/patientAccess";

/**
 * Marca una alerta como revisada. Solo accesible por fisios con acceso a la
 * clínica de la alerta. Idempotente.
 */
export const markAsRead = mutation({
  args: {
    alertId: v.id("physioAlerts"),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await getAuthenticatedUser(ctx);
    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alerta no encontrada");
    await assertFisioInClinic(ctx, user._id, alert.clinicId);

    if (alert.estado === "revisada") return;
    await ctx.db.patch(args.alertId, {
      estado: "revisada",
      fechaRevision: new Date().toISOString(),
      revisadaPor: user._id,
    });
  },
});

/**
 * Marca todas las alertas pendientes como revisadas. Si se pasa `clinicId`,
 * actúa solo sobre esa clínica. Si no, sobre todas las clínicas que el fisio
 * gestiona.
 */
export const markAllAsRead = mutation({
  args: {
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args): Promise<{ revisadas: number }> => {
    const user = await getAuthenticatedUser(ctx);

    const clinicIds = args.clinicId
      ? [args.clinicId]
      : await getManagedClinicIds(ctx, user._id);

    if (args.clinicId) {
      await assertFisioInClinic(ctx, user._id, args.clinicId);
    }

    const fechaRevision = new Date().toISOString();
    let revisadas = 0;
    for (const clinicId of clinicIds) {
      const pendientes = await ctx.db
        .query("physioAlerts")
        .withIndex("by_clinicId_estado", (q) =>
          q.eq("clinicId", clinicId).eq("estado", "pendiente"),
        )
        .collect();
      for (const a of pendientes) {
        await ctx.db.patch(a._id, {
          estado: "revisada",
          fechaRevision,
          revisadaPor: user._id,
        });
        revisadas += 1;
      }
    }
    return { revisadas };
  },
});

/**
 * Marca todas las alertas pendientes de un paciente concreto como revisadas.
 * Útil para la vista "comentarios del paciente" del fisio. El usuario debe
 * ser fisio/admin en la clínica del paciente.
 */
export const markAllAsReadForPatient = mutation({
  args: {
    pacienteId: v.string(),
  },
  handler: async (ctx, args): Promise<{ revisadas: number }> => {
    const user = await getAuthenticatedUser(ctx);
    const targetId = args.pacienteId as Id<"users">;

    const membership = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", targetId))
      .first();
    if (!membership) return { revisadas: 0 };
    await assertFisioInClinic(ctx, user._id, membership.clinicId);

    const pendientes = await ctx.db
      .query("physioAlerts")
      .withIndex("by_pacienteId_estado", (q) =>
        q.eq("pacienteId", targetId).eq("estado", "pendiente"),
      )
      .collect();

    const fechaRevision = new Date().toISOString();
    let revisadas = 0;
    for (const a of pendientes) {
      await ctx.db.patch(a._id, {
        estado: "revisada",
        fechaRevision,
        revisadaPor: user._id,
      });
      revisadas += 1;
    }
    return { revisadas };
  },
});
