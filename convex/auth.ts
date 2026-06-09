import {
  createClient,
  type GenericCtx,
  type AuthFunctions,
} from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { admin, magicLink } from "better-auth/plugins";
import { components, internal } from "./_generated/api";
import { query } from "./_generated/server";
// `better-auth/minimal` es el inicializador sin Kysely, recomendado para Convex
// (la persistencia la provee el adapter del componente, no Kysely). Es el mismo
// `betterAuth` que usa internamente @convex-dev/better-auth.
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
// Schema del componente en LOCAL INSTALL — incluye los campos del plugin admin.
import authSchema from "./betterAuth/schema";

// Better-Auth necesita una baseURL absoluta para construir URLs en flujos
// async (magic-link, reset password, etc.) cuando se invoca desde un
// httpAction sin Request context.
//
// IMPORTANTE (local install): NO validamos/lanzamos en top-level. Este módulo lo
// importa el componente local (`convex/betterAuth/adapter.ts`) durante el ANÁLISIS
// de módulos del push, en un contexto donde las env vars del deployment pueden no
// estar disponibles. Un `throw` aquí rompía el push entero:
//   "Failed to analyze adapter.js: [auth] SITE_URL no está definido".
// La validación estricta vive ahora en `createAuth()` (se invoca en runtime, con
// las env vars presentes). Para el path de generación de schema basta con un
// baseURL placeholder válido — su valor no afecta a `getAuthTables`.
const appUrl = process.env["APP_URL"] ?? "https://kengoapp.com";
const resolveSiteUrl = () => process.env["SITE_URL"] ?? appUrl;

// NOTA sobre la firma del JWT de Convex:
//
// - El JWT lo firma el plugin `@convex-dev/better-auth/plugins:convex` con:
//     issuer    = process.env.CONVEX_SITE_URL  (env var inyectada por Convex)
//     audience  = "convex"                     (literal en el plugin)
//     expiresIn = 15 minutos                   (default del plugin)
//     applicationID = "convex"                 (literal hardcoded; el plugin
//                                               filtra providers por este id)
// - La validación la hace Convex usando `auth.config.ts` (provider devuelto
//   por `getAuthConfigProvider()`), que también lee CONVEX_SITE_URL como
//   issuer. Por construcción ambas piezas leen la misma env var del runtime
//   de Convex, así que no puede haber mismatch — no es necesario configurar
//   un `applicationID` propio (de hecho, el plugin lo exige hardcoded a
//   "convex" y lanza error si no encuentra un provider con ese id).
// - SITE_URL (esta variable) y CONVEX_SITE_URL son distintas: SITE_URL es
//   nuestro dominio público (backend.kengoapp.com), CONVEX_SITE_URL es la
//   URL del HTTP router que Convex provisiona automáticamente. Si tenemos
//   un custom domain apuntando al HTTP router los valores coinciden.

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

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
  // LOCAL INSTALL: el cliente usa nuestro schema local (con campos del plugin
  // admin) para tipar y validar las operaciones contra el componente.
  local: { schema: authSchema },
  verbose: false,
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        // Sincronizar usuario Better-Auth con tabla users de la app.
        const nameParts = (doc.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const existing = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", doc.email))
          .unique();

        if (existing) {
          // Solo permitimos rebindear el externalId si la fila estaba en estado
          // pre-registro (paciente creado por el fisio con `pending-{email}`,
          // ver `users/mutations.ts:upsertPatientWithMembership`). Cualquier
          // otra fila ya está enlazada a una cuenta BA real y NO debe
          // rebindearse silenciosamente — sería account takeover.
          const isPending =
            typeof existing.externalId === "string" &&
            existing.externalId.startsWith("pending-");

          if (!isPending) {
            console.error("[auth.onCreate] Rebind rechazado: email ya enlazado", {
              email: doc.email,
              currentExternalId: existing.externalId,
              attemptedExternalId: doc._id,
            });
            throw new Error("EMAIL_ALREADY_LINKED");
          }

          console.info("[auth.onCreate] Rebind pending → BA user", {
            email: doc.email,
            from: existing.externalId,
            to: doc._id,
          });
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

/**
 * Opciones de Better-Auth, separadas de la instanciación.
 *
 * Esta separación es un requisito del LOCAL INSTALL: el componente
 * (`convex/betterAuth/adapter.ts`) pasa `createAuthOptions` a `createApi`, que la
 * invoca con `ctx = {}` SOLO para derivar el schema vía `getAuthTables` (no usa el
 * `database` adapter, por eso el ctx vacío es seguro). La instancia real de auth se
 * crea con `createAuth(ctx)` más abajo.
 */
export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    // Necesario para que `auth.api.signInMagicLink` (y el plugin
    // magic-link en general) construya correctamente la URL del verify.
    // Sin esto, `ctx.context.baseURL` queda vacío cuando se invoca
    // programáticamente desde un httpAction y `new URL('')` lanza
    // "Invalid URL: ''".
    baseURL: resolveSiteUrl(),
    trustedOrigins: [
      appUrl,
      `https://www.${appUrl.replace(/^https?:\/\//, "")}`,
      "http://localhost:4200",
      "http://localhost:4210",
      // App nativa Capacitor: origin definido en `apps/app/capacitor.config.ts`
      // (`server.hostname` + `iosScheme/androidScheme: 'https'`).
      "https://app.kengoapp.local",
      // iOS WKWebView puede enviar el Origin con el esquema interno aunque la
      // SPA cargue por https. Lo permitimos explícitamente.
      "capacitor://app.kengoapp.local",
      // Esquemas por defecto del WebView Capacitor cuando no se sobreescriben.
      "capacitor://localhost",
      "https://localhost",
    ],
    database: authComponent.adapter(ctx),
    // TTL de la sesión (cookie + fila en betterAuth_sessions). Los valores son
    // explícitos en lugar de aceptar los defaults de Better-Auth para
    // documentar nuestra elección y reducir la ventana de divergencia entre
    // la cookie del cliente y el estado real en servidor:
    //
    // - `expiresIn` (7 días) es el TTL absoluto. Si el usuario no abre la app
    //   en 7 días la sesión caduca. Pensado para fisios/pacientes con uso
    //   semanal — bajarlo demasiado generaría logout cada lunes.
    // - `updateAge` (4 horas) es el refresh "sliding": cada vez que el usuario
    //   hace una request pasadas 4 h desde la última renovación, Better-Auth
    //   extiende la cookie. Esto recorta la ventana zombie a un máximo de 4 h
    //   (en vez de los 7 días que tarda la cookie en caducar por sí sola tras
    //   una invalidación server-side) sin saturar el backend.
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 días
      updateAge: 60 * 60 * 4, // 4 horas
    },
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
      crossDomain({ siteUrl: resolveSiteUrl() }),
      convex({ authConfig }),
      magicLink({
        expiresIn: 5 * 60,
        sendMagicLink: async ({ email, token }) => {
          // No enviamos email — el token se usa en el flujo de consumo
          // de access tokens QR. El HTTP handler lo captura de aquí.
          pendingMagicLinks.set(email, token);
        },
      }),
      // Plugin admin: habilita la impersonación de usuarios por parte del equipo
      // de soporte (`auth.api.impersonateUser` / `stopImpersonating`). Marca la
      // sesión con `impersonatedBy` (ver convex/betterAuth/schema.ts).
      //
      // `adminUserIds`: allowlist de externalIds (id de Better-Auth) de los
      // técnicos autorizados. Cuando está definido, el sistema de roles se ignora
      // (no hace falta campo `role` poblado). Se configura por env var:
      //   npx convex env set SUPPORT_USER_IDS "<id1>,<id2>"
      // Si la env var está vacía, NADIE puede impersonar (lista vacía), pero el
      // schema del plugin sigue presente — seguro por defecto.
      admin({
        adminUserIds: (process.env["SUPPORT_USER_IDS"] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        // Ventana corta de impersonación (default de Better-Auth es 1 h).
        impersonationSessionDuration: 60 * 30, // 30 minutos
        // No permitir impersonar a otros técnicos/admins.
        allowImpersonatingAdmins: false,
      }),
    ],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  // Validación estricta en runtime (aquí SÍ están las env vars del deployment).
  // Antes vivía en top-level, pero rompía el análisis del componente local.
  if (!process.env["SITE_URL"]) {
    throw new Error(
      "[auth] SITE_URL no está definido. Configurarlo con `npx convex env set SITE_URL <url>` antes de desplegar.",
    );
  }
  return betterAuth(createAuthOptions(ctx));
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx);
  },
});
