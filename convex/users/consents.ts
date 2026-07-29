/**
 * Registro de consentimientos RGPD.
 *
 * El art. 7.1 del RGPD obliga a poder **demostrar** que el interesado
 * consintió, y el 9.2.a) exige que para datos de salud ese consentimiento sea
 * explícito. Sin esta traza, la casilla del formulario de registro no probaría
 * nada ante una inspección de la AEPD.
 */

import { v } from "convex/values";
import { internalMutation, query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";

const TIPOS = ["terminos_privacidad", "datos_salud"] as const;

/**
 * Deja constancia de los consentimientos prestados al registrarse.
 *
 * Se invoca desde `auth.actions.register` una vez creado el usuario, buscando
 * por email porque en ese punto el documento acaba de crearse y el llamante no
 * tiene todavía el `userId`.
 */
export const recordSignupConsents = internalMutation({
  args: {
    email: v.string(),
    version: v.string(),
    origen: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (!user) {
      // No abortamos el registro por esto: el usuario ya existe en
      // Better-Auth y bloquearlo dejaría la cuenta a medias. Se registra para
      // poder detectarlo.
      console.error(
        `[consents] usuario no encontrado al registrar consentimiento: ${args.email}`,
      );
      return { registrados: 0 };
    }

    const ahora = Date.now();
    let registrados = 0;

    for (const tipo of TIPOS) {
      await ctx.db.insert("consents", {
        userId: user._id,
        tipo,
        version: args.version,
        aceptadoEn: ahora,
        origen: args.origen,
      });
      registrados++;
    }

    return { registrados };
  },
});

/**
 * Consentimientos del usuario actual. Permite comparar la versión aceptada con
 * la vigente para decidir si hay que pedir un nuevo consentimiento.
 */
export const myConsents = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return await ctx.db
      .query("consents")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
  },
});
