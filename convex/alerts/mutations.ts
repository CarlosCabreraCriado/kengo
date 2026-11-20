import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import {
  assertFisioInClinic,
  getManagedClinicIds,
  getSharedClinicIdsForPaciente,
} from "../_helpers/patientAccess";
import {
  pendingAlertsVisiblesEnClinica,
  puedeGestionarPaciente,
} from "../_helpers/fisioScope";

const SIN_PERMISO_REVISAR =
  "Solo el fisio responsable del paciente o un administrador puede marcar sus alertas como revisadas";

/**
 * Marca una alerta como revisada. Solo puede hacerlo el fisio responsable del
 * paciente o un admin de la clínica de la alerta. Idempotente.
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
    if (
      !(await puedeGestionarPaciente(
        ctx,
        user._id,
        alert.clinicId,
        alert.pacienteId,
      ))
    ) {
      throw new ConvexError(SIN_PERMISO_REVISAR);
    }

    if (alert.estado === "revisada") return;
    await ctx.db.patch(args.alertId, {
      estado: "revisada",
      fechaRevision: new Date().toISOString(),
      revisadaPor: user._id,
    });
  },
});

/**
 * Marca como revisadas las alertas pendientes que el usuario ve (las mismas
 * que devuelve `listForCurrentFisio`): todas para admins, solo las de sus
 * pacientes asignados para fisios. Si se pasa `clinicId`, actúa solo sobre
 * esa clínica; si no, sobre todas las clínicas que el usuario gestiona.
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
      const pendientes = await pendingAlertsVisiblesEnClinica(
        ctx,
        user._id,
        clinicId,
      );
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
 * Útil para la vista "comentarios del paciente" del fisio. Cualquier fisio de
 * la clínica puede leerlas (`listByPaciente`), pero solo el responsable o un
 * admin puede marcarlas.
 */
export const markAllAsReadForPatient = mutation({
  args: {
    pacienteId: v.string(),
    // Clínica activa del fisio (opcional para clientes antiguos).
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args): Promise<{ revisadas: number }> => {
    const user = await getAuthenticatedUser(ctx);
    const targetId = args.pacienteId as Id<"users">;

    // Solo se tocan alertas de clínicas que el fisio gestiona y comparte con
    // el paciente: un paciente multiclínica tiene alertas de otras clínicas
    // que este fisio no debe marcar.
    const compartidas = await getSharedClinicIdsForPaciente(
      ctx,
      user._id,
      targetId,
      args.clinicId,
    );

    // Y, dentro de ellas, solo donde es responsable del paciente o admin.
    const clinicas = new Set<Id<"clinics">>();
    for (const clinicId of compartidas) {
      if (await puedeGestionarPaciente(ctx, user._id, clinicId, targetId)) {
        clinicas.add(clinicId);
      }
    }
    if (clinicas.size === 0) throw new ConvexError(SIN_PERMISO_REVISAR);

    const pendientes = (
      await ctx.db
        .query("physioAlerts")
        .withIndex("by_pacienteId_estado", (q) =>
          q.eq("pacienteId", targetId).eq("estado", "pendiente"),
        )
        .collect()
    ).filter((a) => clinicas.has(a.clinicId));

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
