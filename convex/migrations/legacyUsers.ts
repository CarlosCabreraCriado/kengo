/**
 * Migración one-shot de usuarios legacy importados desde Directus.
 *
 * Tras migrar el auth de Directus a Convex (Better Auth), los usuarios que
 * existían en Directus se importaron a la tabla `users` con su UUID Directus
 * en `externalId`. Esos usuarios NO tienen cuenta Better Auth todavía y, como
 * sus hashes de Directus no son compatibles con BA, necesitan resetear la
 * contraseña para poder entrar.
 *
 * El endpoint `/api/auth/convex-reset-password` (`convex/http.ts`) ya sabe
 * crear la cuenta BA automáticamente cuando el usuario está marcado como
 * `pending-{email}` (caso "paciente pre-creado por fisio"). Esta migración
 * convierte a los legacies a ese mismo estado para que puedan reusar el
 * flujo existente.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/legacyUsers:migrateLegacyUsers
 *   npx convex run migrations/legacyUsers:migrateLegacyUsers --prod
 *
 * Idempotente: re-ejecutarla no toca a los ya migrados (pending-) ni a los
 * usuarios con cuenta Better Auth real.
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export const listAllUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      externalId: u.externalId,
      email: u.email,
    }));
  },
});

export const patchToPending = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return { ok: false, reason: "NOT_FOUND" } as const;
    if (user.externalId.startsWith("pending-")) {
      return { ok: false, reason: "ALREADY_PENDING" } as const;
    }
    await ctx.db.patch(args.userId, {
      externalId: `pending-${args.email}`,
    });
    return { ok: true } as const;
  },
});

type LegacyUserRow = {
  _id: Id<"users">;
  externalId: string;
  email: string;
};

export const migrateLegacyUsers = internalAction({
  args: {},
  handler: async (ctx) => {
    const users: LegacyUserRow[] = await ctx.runQuery(
      internal.migrations.legacyUsers.listAllUsers,
      {},
    );

    let alreadyPending = 0;
    let linkedToBA = 0;
    let migrated = 0;
    let doubleRegistered = 0;

    for (const user of users) {
      if (user.externalId.startsWith("pending-")) {
        alreadyPending++;
        continue;
      }

      const baUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "email", value: user.email }],
      });

      if (baUser) {
        if (baUser["_id"] !== user.externalId && baUser["id"] !== user.externalId) {
          // Hay BA user con ese email pero el externalId Convex apunta a otra
          // cosa — caso anómalo que conviene auditar a mano.
          doubleRegistered++;
          console.warn("[legacyUsers] doble registro detectado", {
            userId: user._id,
            email: user.email,
            convexExternalId: user.externalId,
            baUserId: baUser["_id"] ?? baUser["id"],
          });
        } else {
          linkedToBA++;
        }
        continue;
      }

      await ctx.runMutation(internal.migrations.legacyUsers.patchToPending, {
        userId: user._id,
        email: user.email,
      });
      migrated++;
      console.info("[legacyUsers] migrated", {
        userId: user._id,
        email: user.email,
        oldExternalId: user.externalId,
      });
    }

    const summary = {
      total: users.length,
      alreadyPending,
      linkedToBA,
      migrated,
      doubleRegistered,
    };
    console.info("[legacyUsers] resumen", summary);
    return summary;
  },
});
