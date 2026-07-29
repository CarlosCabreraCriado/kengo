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
import type { DeletionBlocker } from "./deletion";

/**
 * Borrado definitivo de la cuenta del usuario autenticado.
 *
 * La identidad sale **siempre de la sesión**: no se acepta un email o un id
 * del cliente, porque en un endpoint autenticado eso permitiría borrar la
 * cuenta de otra persona.
 */
export const deleteMyAccount = action({
  args: {
    /**
     * El usuario reescribe su email para confirmar. No es un control de
     * seguridad (la identidad ya viene de la sesión), sino una barrera contra
     * el borrado accidental: la operación es irreversible.
     */
    confirmacionEmail: v.string(),
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
