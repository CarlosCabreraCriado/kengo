/**
 * Queries de impersonación (soporte técnico).
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { isSupportTechnician } from "../_helpers/support";

/**
 * Indica si el usuario autenticado es un técnico de soporte autorizado a
 * impersonar (está en la allowlist `SUPPORT_USER_IDS`).
 *
 * El frontend la usa para gatear la UI de soporte SIN embeber la allowlist en
 * el bundle del cliente.
 *
 * NOTA: durante una impersonación, `identity.subject` es el usuario suplantado
 * (no el técnico), por lo que esta query devuelve `false` mientras se impersona
 * — comportamiento correcto: el técnico "es" el usuario y no debe ver la UI de
 * soporte hasta salir de la impersonación.
 */
export const amISupportTechnician = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    return isSupportTechnician(identity.subject);
  },
});

/**
 * Resuelve un usuario objetivo por email para impersonarlo. Solo accesible para
 * técnicos de soporte. Devuelve el `externalId` (que es el `userId` que espera
 * `authClient.admin.impersonateUser`) y datos para confirmar visualmente quién
 * se va a suplantar.
 *
 * Devuelve `null` si no existe o si el caller no es técnico (no se distingue,
 * para no filtrar existencia de emails a no-técnicos).
 */
export const lookupTarget = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !isSupportTechnician(identity.subject)) return null;

    const email = args.email.trim().toLowerCase();
    if (!email) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) return null;

    // No permitir impersonar a otro técnico de soporte (paralelo a
    // `allowImpersonatingAdmins: false` en el plugin admin).
    if (isSupportTechnician(user.externalId)) return null;

    return {
      externalId: user.externalId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  },
});
