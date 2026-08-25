"use node";

/**
 * Ejecución del borrado de cuenta. Runtime Node porque la purga toca
 * Better-Auth y el bucket R2 (ver `migrations/deleteUserByEmail`).
 *
 * El *preflight* informativo vive en `users/deletion.ts`; la resolución de
 * identidad y la revalidación de bloqueos, en `users/deletionInternal.ts`.
 */

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { purgeUser } from "../migrations/deleteUserByEmail";
import type { ClinicaACerrar, DeletionBlocker } from "./deletion";

/**
 * Borrado definitivo de la cuenta del usuario autenticado.
 *
 * La identidad sale **siempre de la sesión**: no se acepta un email o un id
 * del cliente, porque en un endpoint autenticado eso permitiría borrar la
 * cuenta de otra persona.
 *
 * Si el usuario es propietario de alguna clínica, esas clínicas se cierran en
 * cascada como parte del borrado — cancelando antes su suscripción de Stripe.
 * Antes esto era un bloqueo, pero dejaba sin salida al fisioterapeuta que
 * trabaja solo y por tanto incumplía la guideline 5.1.1(v) de Apple (ver la
 * cabecera de `users/deletion.ts`). El cierre exige confirmación explícita del
 * usuario, porque destruye datos de sus pacientes.
 */
export const deleteMyAccount = action({
  args: {
    /**
     * El usuario reescribe su email para confirmar. No es un control de
     * seguridad (la identidad ya viene de la sesión), sino una barrera contra
     * el borrado accidental: la operación es irreversible.
     */
    confirmacionEmail: v.string(),
    /**
     * Consentimiento explícito para cerrar las clínicas de las que el usuario
     * es propietario. Sin él, si hay alguna, el borrado se rechaza: la UI debe
     * haber enseñado antes qué se pierde.
     */
    confirmarCierreDeClinicas: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("No autenticado");
    }

    const check: {
      userId: Id<"users">;
      email: string;
      bloqueos: DeletionBlocker[];
      clinicasACerrar: ClinicaACerrar[];
    } = await ctx.runQuery(internal.users.deletionInternal.resolveForDeletion, {
      externalId: identity.subject,
    });

    if (check.bloqueos.length > 0) {
      throw new Error(
        `DELETION_BLOCKED: ${check.bloqueos.map((b) => b.detalle).join(" | ")}`,
      );
    }

    if (
      args.confirmacionEmail.trim().toLowerCase() !==
      check.email.trim().toLowerCase()
    ) {
      throw new Error("EMAIL_MISMATCH: el email de confirmación no coincide");
    }

    if (check.clinicasACerrar.length > 0 && !args.confirmarCierreDeClinicas) {
      throw new Error(
        `CLINIC_CLOSURE_NOT_CONFIRMED: eliminar tu cuenta cerraría ${check.clinicasACerrar
          .map((c) => `"${c.clinicNombre}"`)
          .join(", ")}. Hace falta confirmarlo explícitamente.`,
      );
    }

    // Orden deliberado: Stripe primero, cascada después, usuario al final.
    //
    // Si algo falla a mitad, el estado intermedio es recuperable: una clínica
    // sin suscripción y con su propietario todavía vivo se puede volver a
    // borrar reintentando. Al revés — purgar al usuario y dejar la clínica
    // huérfana, o dejar viva una suscripción que sigue cobrando a una cuenta
    // que ya no existe — no lo sería.
    for (const clinica of check.clinicasACerrar) {
      await ctx.runAction(
        internal.billing.actions.cancelSubscriptionForClinicClosure,
        { clinicId: clinica.clinicId },
      );
      await ctx.runMutation(
        internal.users.deletionInternal.purgeClinicForAccountDeletion,
        { clinicId: clinica.clinicId, ownerUserId: check.userId },
      );
    }

    await purgeUser(ctx, { userId: check.userId });

    return { ok: true };
  },
});

/**
 * Purga por `userId` para uso interno: atender desde soporte una solicitud
 * recibida por la web. No comprueba bloqueos — quien la invoca es un operador
 * que ya ha valorado el caso (transferencia de propiedad, suscripción, etc.).
 */
export const purgeUserById = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => purgeUser(ctx, { userId: args.userId }),
});
