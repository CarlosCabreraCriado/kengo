/**
 * Schema del componente Better-Auth (LOCAL INSTALL).
 *
 * Este fichero es un superset FIEL del schema empaquetado en
 * `@convex-dev/better-auth/src/component/schema.ts`. Se ha copiado verbatim y se
 * le han añadido EXCLUSIVAMENTE los campos que introduce el plugin `admin` de
 * Better-Auth, todos opcionales para que las filas existentes (que no los tienen)
 * sigan validando:
 *
 *   user.role          (admin plugin)
 *   user.banned        (admin plugin)
 *   user.banReason     (admin plugin)
 *   user.banExpires    (admin plugin, tipo "date" → number en Convex)
 *   session.impersonatedBy (admin plugin — id del técnico que impersona)
 *
 * Mantener este fichero en sync si se añaden/quitan plugins de Better-Auth en
 * `convex/auth.ts`. Para regenerarlo desde cero con el CLI oficial:
 *   cd convex/betterAuth && npx @better-auth/cli generate
 * (requiere un `auth.ts` que exporte la instancia; ver docs de local-install).
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const tables = {
  user: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
    twoFactorEnabled: v.optional(v.union(v.null(), v.boolean())),
    isAnonymous: v.optional(v.union(v.null(), v.boolean())),
    username: v.optional(v.union(v.null(), v.string())),
    displayUsername: v.optional(v.union(v.null(), v.string())),
    phoneNumber: v.optional(v.union(v.null(), v.string())),
    phoneNumberVerified: v.optional(v.union(v.null(), v.boolean())),
    userId: v.optional(v.union(v.null(), v.string())),
    // --- admin plugin ---
    role: v.optional(v.union(v.null(), v.string())),
    banned: v.optional(v.union(v.null(), v.boolean())),
    banReason: v.optional(v.union(v.null(), v.string())),
    banExpires: v.optional(v.union(v.null(), v.number())),
  })
    .index("email_name", ["email", "name"])
    .index("name", ["name"])
    .index("userId", ["userId"])
    .index("username", ["username"])
    .index("phoneNumber", ["phoneNumber"]),
  session: defineTable({
    expiresAt: v.number(),
    token: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ipAddress: v.optional(v.union(v.null(), v.string())),
    userAgent: v.optional(v.union(v.null(), v.string())),
    userId: v.string(),
    // --- admin plugin ---
    impersonatedBy: v.optional(v.union(v.null(), v.string())),
  })
    .index("expiresAt", ["expiresAt"])
    .index("expiresAt_userId", ["expiresAt", "userId"])
    .index("token", ["token"])
    .index("userId", ["userId"]),
  account: defineTable({
    accountId: v.string(),
    providerId: v.string(),
    userId: v.string(),
    accessToken: v.optional(v.union(v.null(), v.string())),
    refreshToken: v.optional(v.union(v.null(), v.string())),
    idToken: v.optional(v.union(v.null(), v.string())),
    accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    scope: v.optional(v.union(v.null(), v.string())),
    password: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("accountId", ["accountId"])
    .index("accountId_providerId", ["accountId", "providerId"])
    .index("providerId_userId", ["providerId", "userId"])
    .index("userId", ["userId"]),
  verification: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("expiresAt", ["expiresAt"])
    .index("identifier", ["identifier"]),
  twoFactor: defineTable({
    secret: v.string(),
    backupCodes: v.string(),
    userId: v.string(),
  }).index("userId", ["userId"]),
  oauthApplication: defineTable({
    name: v.optional(v.union(v.null(), v.string())),
    icon: v.optional(v.union(v.null(), v.string())),
    metadata: v.optional(v.union(v.null(), v.string())),
    clientId: v.optional(v.union(v.null(), v.string())),
    clientSecret: v.optional(v.union(v.null(), v.string())),
    redirectUrls: v.optional(v.union(v.null(), v.string())),
    type: v.optional(v.union(v.null(), v.string())),
    disabled: v.optional(v.union(v.null(), v.boolean())),
    userId: v.optional(v.union(v.null(), v.string())),
    createdAt: v.optional(v.union(v.null(), v.number())),
    updatedAt: v.optional(v.union(v.null(), v.number())),
  })
    .index("clientId", ["clientId"])
    .index("userId", ["userId"]),
  oauthAccessToken: defineTable({
    accessToken: v.optional(v.union(v.null(), v.string())),
    refreshToken: v.optional(v.union(v.null(), v.string())),
    accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    clientId: v.optional(v.union(v.null(), v.string())),
    userId: v.optional(v.union(v.null(), v.string())),
    scopes: v.optional(v.union(v.null(), v.string())),
    createdAt: v.optional(v.union(v.null(), v.number())),
    updatedAt: v.optional(v.union(v.null(), v.number())),
  })
    .index("accessToken", ["accessToken"])
    .index("refreshToken", ["refreshToken"])
    .index("clientId", ["clientId"])
    .index("userId", ["userId"]),
  oauthConsent: defineTable({
    clientId: v.optional(v.union(v.null(), v.string())),
    userId: v.optional(v.union(v.null(), v.string())),
    scopes: v.optional(v.union(v.null(), v.string())),
    createdAt: v.optional(v.union(v.null(), v.number())),
    updatedAt: v.optional(v.union(v.null(), v.number())),
    consentGiven: v.optional(v.union(v.null(), v.boolean())),
  })
    .index("clientId_userId", ["clientId", "userId"])
    .index("userId", ["userId"]),
  jwks: defineTable({
    publicKey: v.string(),
    privateKey: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.union(v.null(), v.number())),
  }),
  rateLimit: defineTable({
    key: v.string(),
    count: v.number(),
    lastRequest: v.number(),
  }).index("key", ["key"]),
};

const schema = defineSchema(tables);

export default schema;
