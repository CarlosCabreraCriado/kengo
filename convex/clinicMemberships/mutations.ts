import { v } from "convex/values";
import { mutation, MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  checkClinicPermission,
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
 * Cascada cuando se elimina una membresía de `fisio` o `admin`:
 *   - Borra `assignments` donde figuraba como responsable.
 *   - Archiva conversaciones del fisio/admin en esa clínica.
 *   - Los planes que había creado se mantienen (los pacientes los necesitan).
 *
 * Asume que la membresía ya ha sido eliminada por el caller.
 */
async function cascadeRemoveStaff(
  ctx: MutationCtx,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
): Promise<void> {
  const ahora = Date.now();

  const assignments = await ctx.db
    .query("assignments")
    .withIndex("by_fisioId_clinicId", (q) =>
      q.eq("fisioId", userId).eq("clinicId", clinicId),
    )
    .collect();
  for (const a of assignments) await ctx.db.delete(a._id);

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
      await cascadeRemoveStaff(ctx, userId, clinicId);
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

/**
 * Expulsa a un fisio de una clínica.
 *
 * Restricciones:
 *   - Solo un `admin` de la clínica puede invocarla.
 *   - El target debe tener puesto `fisio` (no se permite expulsar a otros
 *     `admin` ni a `paciente` — los pacientes se gestionan con `remove`).
 *   - No se puede expulsar a uno mismo (un admin que quiera salir debe
 *     usar otra acción explícita).
 *
 * La cascada es la misma que en `remove` para el caso `fisio` (delete
 * assignments + archive conversations + sync de Stripe).
 */
export const expelMember = mutation({
  args: {
    clinicId: v.id("clinics"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedUser(ctx);
    await checkClinicPermission(ctx, actor._id, args.clinicId, ["admin"]);

    if (actor._id === args.userId) {
      throw new Error("No puedes expulsarte a ti mismo");
    }

    const membership: Doc<"clinicMemberships"> | null = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", args.userId).eq("clinicId", args.clinicId),
      )
      .unique();

    if (!membership) {
      throw new Error("El usuario no pertenece a esta clínica");
    }

    if (membership.puesto !== "fisio") {
      throw new Error(
        "Solo se puede expulsar a fisioterapeutas (no pacientes ni administradores)",
      );
    }

    await ctx.db.delete(membership._id);
    await cascadeRemoveStaff(ctx, args.userId, args.clinicId);

    await ctx.scheduler.runAfter(
      0,
      internal.billing.internal.syncQuantityFromMemberships,
      { clinicId: args.clinicId },
    );

    return { ok: true };
  },
});
