import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  getAuthenticatedUser,
  requireActiveSubscription,
} from "../_helpers/permissions";

const PUESTOS_FACTURABLES: ReadonlyArray<"fisio" | "admin"> = [
  "fisio",
  "admin",
] as const;

function esFacturable(puesto: "fisio" | "paciente" | "admin"): boolean {
  return (PUESTOS_FACTURABLES as ReadonlyArray<string>).includes(puesto);
}

/**
 * Añade una membresía usuario-clínica.
 */
export const add = mutation({
  args: {
    userId: v.id("users"),
    clinicId: v.id("clinics"),
    puesto: v.union(
      v.literal("fisio"),
      v.literal("paciente"),
      v.literal("admin"),
    ),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    // Solo bloquear el alta si el nuevo puesto es facturable. Pacientes
    // pueden seguir vinculándose aunque la clínica esté impagada.
    if (args.puesto === "fisio" || args.puesto === "admin") {
      await requireActiveSubscription(ctx, args.clinicId);
    }

    const existing = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", args.userId).eq("clinicId", args.clinicId),
      )
      .unique();

    let puestoAnterior: "fisio" | "paciente" | "admin" | null = null;
    let resultId;
    if (existing) {
      puestoAnterior = existing.puesto;
      if (existing.puesto !== args.puesto) {
        await ctx.db.patch(existing._id, { puesto: args.puesto });
      }
      resultId = existing._id;
    } else {
      resultId = await ctx.db.insert("clinicMemberships", {
        userId: args.userId,
        clinicId: args.clinicId,
        puesto: args.puesto,
      });
    }

    // Sync con Stripe si el puesto resultante o el anterior era facturable.
    if (esFacturable(args.puesto) || (puestoAnterior && esFacturable(puestoAnterior))) {
      await ctx.scheduler.runAfter(
        0,
        internal.billing.internal.syncQuantityFromMemberships,
        { clinicId: args.clinicId },
      );
    }

    return resultId;
  },
});

/**
 * Elimina una membresía por id, con cascada controlada:
 *
 *   - Si el puesto era `paciente`:
 *       · Borrar `assignments(pacienteId, clinicId)` del usuario.
 *       · Cancelar (`estado: "cancelado"`) los planes activos o en borrador
 *         del paciente atribuidos a esa clínica. Los planes no se borran
 *         para preservar el historial clínico de actividad.
 *
 *   - Si el puesto era `fisio` o `admin`:
 *       · Borrar `assignments(fisioId, clinicId)` donde figuraba como
 *         responsable. Los pacientes que dependían de él quedarán sin
 *         responsable hasta que un admin reasigne.
 *       · Los planes que ese fisio había creado NO se tocan (los pacientes
 *         siguen necesitándolos para sus sesiones).
 *
 * En cualquier caso, si el puesto eliminado era facturable, se sincroniza
 * la cantidad con Stripe.
 */
export const remove = mutation({
  args: { membershipId: v.id("clinicMemberships") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) return { ok: true };

    const eraFacturable = esFacturable(membership.puesto);
    const clinicId = membership.clinicId;
    const userId = membership.userId;
    const puesto = membership.puesto;

    await ctx.db.delete(args.membershipId);

    const ahora = Date.now();

    if (puesto === "paciente") {
      const assignments = await ctx.db
        .query("assignments")
        .withIndex("by_pacienteId_clinicId", (q) =>
          q.eq("pacienteId", userId).eq("clinicId", clinicId),
        )
        .collect();
      for (const a of assignments) await ctx.db.delete(a._id);

      const planesActivos = await ctx.db
        .query("plans")
        .withIndex("by_pacienteId_estado", (q) =>
          q.eq("pacienteId", userId).eq("estado", "activo"),
        )
        .collect();
      const planesBorrador = await ctx.db
        .query("plans")
        .withIndex("by_pacienteId_estado", (q) =>
          q.eq("pacienteId", userId).eq("estado", "borrador"),
        )
        .collect();
      for (const p of [...planesActivos, ...planesBorrador]) {
        if (p.clinicId === clinicId) {
          await ctx.db.patch(p._id, { estado: "cancelado" });
        }
      }

      // Archiva las conversaciones del paciente atribuidas a esta clínica.
      // No se borran para preservar el historial.
      const conversacionesPaciente = await ctx.db
        .query("conversations")
        .withIndex("by_pacienteId_lastMessageAt", (q) =>
          q.eq("pacienteId", userId),
        )
        .collect();
      for (const c of conversacionesPaciente) {
        if (c.clinicId === clinicId && c.archivedAt === undefined) {
          await ctx.db.patch(c._id, { archivedAt: ahora });
        }
      }
    } else {
      // fisio | admin
      const assignments = await ctx.db
        .query("assignments")
        .withIndex("by_fisioId_clinicId", (q) =>
          q.eq("fisioId", userId).eq("clinicId", clinicId),
        )
        .collect();
      for (const a of assignments) await ctx.db.delete(a._id);

      // Archiva las conversaciones del fisio atribuidas a esta clínica.
      const conversacionesFisio = await ctx.db
        .query("conversations")
        .withIndex("by_fisioId_lastMessageAt", (q) =>
          q.eq("fisioId", userId),
        )
        .collect();
      for (const c of conversacionesFisio) {
        if (c.clinicId === clinicId && c.archivedAt === undefined) {
          await ctx.db.patch(c._id, { archivedAt: ahora });
        }
      }
    }

    if (eraFacturable) {
      await ctx.scheduler.runAfter(
        0,
        internal.billing.internal.syncQuantityFromMemberships,
        { clinicId },
      );
    }

    return { ok: true };
  },
});
