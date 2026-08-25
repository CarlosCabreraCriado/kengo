/**
 * Resolución interna para el borrado de cuenta.
 *
 * La action de borrado (`users/deletionActions.ts`) corre en runtime Node y no
 * tiene acceso a `ctx.db`, así que necesita esta query interna para traducir
 * el `externalId` de la sesión a un `userId` real y revalidar el alcance justo
 * antes de purgar: el preflight que vio la UI pudo quedarse obsoleto entre que
 * se pintó la pantalla y el usuario confirmó (por ejemplo, alguien le
 * transfirió una clínica mientras tanto).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { _purgeClinic } from "../migrations/deleteClinicCascade";
import {
  recolectarClinicasACerrar,
  type ClinicaACerrar,
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
    clinicasACerrar: ClinicaACerrar[];
  }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    // Ser propietario ya no bloquea: sus clínicas se cierran en cascada. Ver
    // la cabecera de `users/deletion.ts` para el porqué (guideline 5.1.1(v)).
    const bloqueos: DeletionBlocker[] = [];
    const clinicasACerrar = await recolectarClinicasACerrar(ctx, user._id);

    return {
      userId: user._id,
      email: user.email,
      bloqueos,
      clinicasACerrar,
    };
  },
});

/**
 * Cierra una clínica como parte del borrado de cuenta de su propietario.
 *
 * Revalida la propiedad dentro de la propia mutation en lugar de fiarse de lo
 * que resolvió la action: entre la resolución y la purga hay un salto de
 * runtime, y esto es una operación irreversible sobre datos de terceros
 * (pacientes, planes, historial). Si la clínica ya no existe o el usuario ya
 * no es su propietario, no borra nada.
 *
 * La suscripción de Stripe debe cancelarse **antes** de llamar aquí (ver
 * `billing.actions.cancelSubscriptionForClinicClosure`): esta mutation borra
 * la fila de `clinicBilling` junto con el resto.
 */
export const purgeClinicForAccountDeletion = internalMutation({
  args: { clinicId: v.id("clinics"), ownerUserId: v.id("users") },
  handler: async (ctx, { clinicId, ownerUserId }): Promise<{ purgada: boolean }> => {
    const clinic = await ctx.db.get(clinicId);
    if (!clinic) return { purgada: false };
    if (clinic.ownerUserId !== ownerUserId) {
      console.warn(
        `[deletion] purgeClinicForAccountDeletion abortada: clinic=${clinicId} ya no pertenece a user=${ownerUserId}`,
      );
      return { purgada: false };
    }

    await _purgeClinic(ctx, clinicId);
    console.log(
      `[deletion] clínica "${clinic.nombre}" (${clinicId}) cerrada por borrado de cuenta de su propietario`,
    );
    return { purgada: true };
  },
});
