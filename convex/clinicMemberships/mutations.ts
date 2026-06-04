import { v } from "convex/values";
import { MutationCtx } from "../_generated/server";
import { mutation } from "../_helpers/mutationWithTriggers";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  assertNotOwnerWithoutTransfer,
  checkClinicPermission,
  getAuthenticatedUser,
  requireActiveSubscription,
} from "../_helpers/permissions";
import { _deletePatientSnapshotsForClinic } from "../snapshots/internal";

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
 * Cascada cuando se elimina la condición de paciente del usuario en la
 * clínica (puesto principal `paciente`, o fisio/admin con
 * `tambienEsPaciente: true` que sale completamente):
 *   - Borra `assignments(pacienteId, clinicId)`.
 *   - Cancela los planes activos del usuario atribuidos a esa clínica
 *     donde figure como paciente (soft-delete, preserva historial).
 *   - Para los planes en borrador: por defecto los cancela (auto-salida del
 *     paciente); si `hardDeleteBorradores: true`, los borra junto con sus
 *     `planExercises` (expulsión por admin: no tiene sentido conservar
 *     borradores que el paciente nunca llegó a ejecutar).
 *   - Archiva conversaciones donde el usuario figuraba como paciente.
 *   - Purga sus `patientMetricsSnapshot` y entradas en los DirectAggregates
 *     `patientsByClinic{Adherencia,RiskScore,Dolor}`.
 *
 * Asume que la membresía ya ha sido eliminada por el caller.
 */
async function cascadeRemovePatient(
  ctx: MutationCtx,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
  options?: { hardDeleteBorradores?: boolean },
): Promise<void> {
  const ahora = Date.now();

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
  for (const p of planesActivos) {
    if (p.clinicId === clinicId) {
      await ctx.db.patch(p._id, { estado: "cancelado" });
    }
  }
  for (const p of planesBorrador) {
    if (p.clinicId !== clinicId) continue;
    if (options?.hardDeleteBorradores) {
      const exes = await ctx.db
        .query("planExercises")
        .withIndex("by_planId", (q) => q.eq("planId", p._id))
        .collect();
      for (const e of exes) await ctx.db.delete(e._id);
      await ctx.db.delete(p._id);
    } else {
      await ctx.db.patch(p._id, { estado: "cancelado" });
    }
  }

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

  await _deletePatientSnapshotsForClinic(ctx, userId, clinicId);
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

    // Los fisios/admins de una clínica actúan automáticamente también como
    // sus propios pacientes: pueden ver el modo paciente, autoasignarse
    // planes y ejercicios. Para puesto `paciente` el flag es redundante.
    const tambienEsPaciente =
      args.puesto === "fisio" || args.puesto === "admin" ? true : undefined;

    let puestoAnterior: "fisio" | "paciente" | "admin" | null = null;
    let resultId;
    if (existing) {
      puestoAnterior = existing.puesto;
      if (existing.puesto !== args.puesto) {
        // Si el cambio degrada a un admin (a fisio/paciente) y ese admin es
        // el propietario, bloquear: debe transferir la propiedad antes.
        if (
          existing.puesto === "admin" &&
          args.puesto !== "admin"
        ) {
          await assertNotOwnerWithoutTransfer(ctx, args.clinicId, args.userId);
        }
        await ctx.db.patch(existing._id, {
          puesto: args.puesto,
          tambienEsPaciente,
        });
      } else if (
        tambienEsPaciente === true &&
        existing.tambienEsPaciente !== true
      ) {
        // Mismo puesto, pero el flag puede no estar seteado (membresía
        // pre-backfill). Lo dejamos consistente.
        await ctx.db.patch(existing._id, { tambienEsPaciente: true });
      }
      resultId = existing._id;
    } else {
      resultId = await ctx.db.insert("clinicMemberships", {
        userId: args.userId,
        clinicId: args.clinicId,
        puesto: args.puesto,
        tambienEsPaciente,
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
    const eraTambienPaciente = membership.tambienEsPaciente === true;

    // Si el miembro saliente es el propietario, exigir transferencia previa.
    // La validación es independiente del estado de billing: el owner debe
    // ceder la responsabilidad SIEMPRE antes de abandonar la clínica.
    if (puesto === "admin") {
      await assertNotOwnerWithoutTransfer(ctx, clinicId, userId);
    }

    await ctx.db.delete(args.membershipId);

    // El usuario actúa como paciente en la clínica si su puesto principal
    // era `paciente`, o si era fisio/admin con `tambienEsPaciente: true`
    // (autoasignación de planes). Al salir, en ambos casos hay que cancelar
    // los planes propios y limpiar sus snapshots.
    const eraPaciente = puesto === "paciente" || eraTambienPaciente;

    if (eraPaciente) {
      await cascadeRemovePatient(ctx, userId, clinicId);
    }
    if (puesto !== "paciente") {
      await cascadeRemoveStaff(ctx, userId, clinicId);
    }

    if (eraFacturable) {
      await ctx.scheduler.runAfter(
        0,
        internal.billing.internal.syncQuantityFromMemberships,
        { clinicId },
      );
    }

    if (eraPaciente) {
      // Sus planes activos/borrador acaban de pasar a "cancelado": refrescar
      // el snapshot agregado de la clínica para que pacientesActivos quede
      // alineado con el listado sin esperar al cron diario.
      await ctx.scheduler.runAfter(
        0,
        internal.snapshots.internal.recomputeClinic,
        { clinicId },
      );
    }

    return { ok: true };
  },
});

/**
 * Expulsa a un paciente de una clínica.
 *
 * Restricciones:
 *   - Solo un `admin` de la clínica puede invocarla.
 *   - El target debe tener puesto `paciente` (no aplica a fisios/admins —
 *     esos se gestionan con `expelMember` o `remove`).
 *   - No se puede expulsar a uno mismo.
 *
 * La cascada (ver `cascadeRemovePatient` con `hardDeleteBorradores: true`):
 *   - Cancela los planes activos del paciente en la clínica (soft-delete,
 *     preserva historial de ejecuciones).
 *   - Hard-delete de los planes en borrador del paciente en la clínica,
 *     junto con sus `planExercises`.
 *   - Borra `assignments`, archiva conversaciones y purga snapshots del
 *     paciente en la clínica.
 *
 * La cuenta del paciente (`users`) se conserva por si vuelve a vincularse
 * en el futuro.
 */
export const expelPatient = mutation({
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
      throw new Error("El paciente no pertenece a esta clínica");
    }

    if (membership.puesto !== "paciente") {
      throw new Error(
        "Esta acción solo aplica a pacientes (no fisios ni administradores)",
      );
    }

    await ctx.db.delete(membership._id);
    await cascadeRemovePatient(ctx, args.userId, args.clinicId, {
      hardDeleteBorradores: true,
    });

    // Sus planes activos/borrador acaban de moverse: refrescar el snapshot
    // agregado de la clínica para que `pacientesActivos` quede alineado con
    // el listado sin esperar al cron diario.
    await ctx.scheduler.runAfter(
      0,
      internal.snapshots.internal.recomputeClinic,
      { clinicId: args.clinicId },
    );

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

/**
 * Promociona un fisioterapeuta a administrador de la clínica.
 *
 * Restricciones:
 *   - Solo un `admin` de la clínica puede invocarla.
 *   - El target debe tener puesto `fisio` (no se promociona a pacientes ni a
 *     quien ya es admin).
 *   - No se puede promocionar a uno mismo.
 *   - La clínica debe tener suscripción activa (ambos puestos son
 *     facturables; bloqueamos reorganización del equipo si Stripe está en
 *     fallo).
 *
 * Sin cascadas: la membresía persiste, los assignments y conversaciones
 * siguen ligados al mismo userId. Sin sync de Stripe: fisio y admin
 * comparten bucket facturable.
 */
export const promoteToAdmin = mutation({
  args: {
    clinicId: v.id("clinics"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedUser(ctx);
    await checkClinicPermission(ctx, actor._id, args.clinicId, ["admin"]);

    if (actor._id === args.userId) {
      throw new Error("No puedes promocionarte a ti mismo");
    }

    await requireActiveSubscription(ctx, args.clinicId);

    const membership = await ctx.db
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
        "Solo se puede promocionar a fisioterapeutas (no pacientes ni administradores)",
      );
    }

    await ctx.db.patch(membership._id, { puesto: "admin" });
    return { ok: true };
  },
});
