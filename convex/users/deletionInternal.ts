/**
 * Resolución interna para el borrado de cuenta.
 *
 * La action de borrado (`users/deletionActions.ts`) corre en runtime Node y no
 * tiene acceso a `ctx.db`, así que necesita esta query interna para traducir
 * el `externalId` de la sesión a un `userId` real y revalidar los bloqueos
 * justo antes de purgar: el preflight que vio la UI pudo quedarse obsoleto
 * entre que se pintó la pantalla y el usuario confirmó.
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  ESTADOS_SUSCRIPCION_VIVA,
  type DeletionBlocker,
} from "./deletion";

export const resolveForDeletion = internalQuery({
  args: { externalId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    userId: Id<"users">;
    email: string;
    bloqueos: DeletionBlocker[];
  }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const bloqueos: DeletionBlocker[] = [];

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    for (const membership of memberships) {
      const clinic = await ctx.db.get(membership.clinicId);
      if (!clinic) continue;
      if (clinic.ownerUserId !== user._id) continue;

      bloqueos.push({
        tipo: "propiedad_clinica",
        clinicId: clinic._id,
        clinicNombre: clinic.nombre,
        detalle: `Eres el propietario de "${clinic.nombre}". Transfiere la propiedad antes de eliminar tu cuenta.`,
      });

      const billing = await ctx.db
        .query("clinicBilling")
        .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
        .unique();

      if (
        billing &&
        (ESTADOS_SUSCRIPCION_VIVA as readonly string[]).includes(
          billing.estadoLocal,
        )
      ) {
        bloqueos.push({
          tipo: "suscripcion_activa",
          clinicId: clinic._id,
          clinicNombre: clinic.nombre,
          detalle: `La clínica "${clinic.nombre}" tiene una suscripción activa. Cancélala antes de eliminar tu cuenta.`,
        });
      }
    }

    return { userId: user._id, email: user.email, bloqueos };
  },
});
