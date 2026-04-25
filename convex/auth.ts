import {
  createClient,
  type GenericCtx,
  type AuthFunctions,
} from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { magicLink } from "better-auth/plugins";
import { components, internal } from "./_generated/api";
import { query } from "./_generated/server";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

const siteUrl = process.env["SITE_URL"]!;

/**
 * Map para capturar tokens de reset generados por Better-Auth.
 * Se usa como puente entre el callback sendResetPassword y el HTTP handler
 * que orquesta el flujo forget+reset dentro de la misma request.
 */
const pendingResetTokens = new Map<string, string>();

export function getPendingResetToken(email: string): string | undefined {
  const token = pendingResetTokens.get(email);
  pendingResetTokens.delete(email);
  return token;
}

export function clearPendingResetToken(email: string): void {
  pendingResetTokens.delete(email);
}

/**
 * Map para capturar tokens de magic link generados por Better-Auth.
 * Usado en el flujo de consumo de access tokens (QR): Convex genera
 * internamente un magic link vía `auth.api.signInMagicLink`, captura el
 * token aquí y devuelve la URL `/magic-link/verify?token=...` al cliente.
 */
const pendingMagicLinks = new Map<string, string>();

export function getPendingMagicLink(email: string): string | undefined {
  const token = pendingMagicLinks.get(email);
  pendingMagicLinks.delete(email);
  return token;
}

export function clearPendingMagicLink(email: string): void {
  pendingMagicLinks.delete(email);
}

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  verbose: false,
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        // Sincronizar usuario Better-Auth con tabla users de la app
        const nameParts = (doc.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const existing = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", doc.email))
          .unique();

        if (existing) {
          // Usuario ya existe (ej: creado por seed) — vincular externalId
          await ctx.db.patch(existing._id, {
            externalId: doc._id,
            emailVerified: doc.emailVerified,
          });
        } else {
          await ctx.db.insert("users", {
            externalId: doc._id,
            email: doc.email,
            emailVerified: doc.emailVerified,
            firstName,
            lastName,
          });
        }
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    trustedOrigins: [siteUrl, "http://localhost:4200", "http://localhost:4210"],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, token }) => {
        // No enviamos email — nuestro propio sistema de códigos maneja eso.
        // Solo capturamos el token para usarlo en el HTTP handler interno.
        pendingResetTokens.set(user.email, token);
      },
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex({ authConfig }),
      magicLink({
        expiresIn: 5 * 60,
        sendMagicLink: async ({ email, token }) => {
          // No enviamos email — el token se usa en el flujo de consumo
          // de access tokens QR. El HTTP handler lo captura de aquí.
          pendingMagicLinks.set(email, token);
        },
      }),
    ],
  } satisfies BetterAuthOptions);

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx);
  },
});
