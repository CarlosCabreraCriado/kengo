"use node";

/**
 * Elimina por completo un usuario por email: registros en Convex, registro en
 * Better-Auth (tablas internas del componente) y avatar en R2.
 *
 * Orquestador para entornos de prueba: crea pacientes/fisios ficticios y
 * límpialos después sin dejar huérfanos. Solo invocable desde Convex Dashboard
 * o CLI:
 *   npx convex run migrations/deleteUserByEmail:run '{"email":"x@y.com"}'
 *   npx convex run migrations/deleteUserByEmail:run '{"email":"x@y.com"}' --prod
 *
 * Si Convex falla, no se toca BA ni R2. Si BA o R2 fallan tras Convex, se
 * loguea el error pero el documento `users` ya no existe (los huérfanos en
 * BA/R2 los recoge el cron `cleanupOrphanR2Keys` o limpieza manual).
 */

import { v } from "convex/values";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { internalAction } from "../_generated/server";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { r2Client, r2Bucket } from "../storage/r2Client";

type WhereClause = {
  field: string;
  value: string | number | boolean | string[] | number[] | null;
  operator?:
    | "lt"
    | "lte"
    | "gt"
    | "gte"
    | "eq"
    | "in"
    | "not_in"
    | "ne"
    | "contains"
    | "starts_with"
    | "ends_with";
  connector?: "AND" | "OR";
};

const BA_PAGE_SIZE = 200;

async function deleteAllBetterAuth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  model: string,
  where: WhereClause[],
): Promise<number> {
  let cursor: string | null = null;
  let total = 0;
  // Loop paginado — la primitiva del componente Better-Auth devuelve isDone.
  while (true) {
    const result: {
      count: number;
      isDone: boolean;
      continueCursor: string;
    } = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model, where },
      paginationOpts: { numItems: BA_PAGE_SIZE, cursor },
    });
    total += result.count;
    if (result.isDone) break;
    cursor = result.continueCursor;
  }
  return total;
}

type RunSummary = {
  email: string;
  userId: Id<"users">;
  externalId: string;
  convex: Record<string, number>;
  betterAuth: {
    sessions: number;
    accounts: number;
    twoFactor: number;
    oauthAccessTokens: number;
    oauthConsents: number;
    verifications: number;
    user: number;
    errors: string[];
  };
  r2: { status: "skipped" | "deleted" | "error"; key: string | null; error: string | null };
};

export const run = internalAction({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<RunSummary> => {
    const { userId, externalId, avatarKey, stats } = await ctx.runMutation(
      internal.migrations.deleteUserByEmailMutation.collectAndDeleteConvex,
      { email: args.email },
    );

    const baStats = {
      sessions: 0,
      accounts: 0,
      twoFactor: 0,
      oauthAccessTokens: 0,
      oauthConsents: 0,
      verifications: 0,
      user: 0,
      errors: [] as string[],
    };

    // Better-Auth: borrar todas las tablas que referencian al usuario.
    const baCleanups: Array<{ model: string; where: WhereClause[]; key: keyof typeof baStats }> = [
      { model: "session", where: [{ field: "userId", value: externalId }], key: "sessions" },
      { model: "account", where: [{ field: "userId", value: externalId }], key: "accounts" },
      { model: "twoFactor", where: [{ field: "userId", value: externalId }], key: "twoFactor" },
      { model: "oauthAccessToken", where: [{ field: "userId", value: externalId }], key: "oauthAccessTokens" },
      { model: "oauthConsent", where: [{ field: "userId", value: externalId }], key: "oauthConsents" },
      { model: "verification", where: [{ field: "identifier", value: args.email }], key: "verifications" },
    ];

    for (const step of baCleanups) {
      try {
        const count = await deleteAllBetterAuth(ctx, step.model, step.where);
        (baStats[step.key] as number) = count;
      } catch (err) {
        const msg = `BA[${step.model}]: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[deleteUserByEmail] ${msg}`);
        baStats.errors.push(msg);
      }
    }

    // Borrar el usuario Better-Auth al final (si la fila aún existe).
    try {
      const userRes: { count: number; isDone: boolean; continueCursor: string } =
        await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
          input: {
            model: "user",
            where: [{ field: "email", value: args.email }],
          },
          paginationOpts: { numItems: 5, cursor: null },
        });
      baStats.user = userRes.count;
    } catch (err) {
      const msg = `BA[user]: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[deleteUserByEmail] ${msg}`);
      baStats.errors.push(msg);
    }

    // R2: borrar avatar si tenía.
    let r2Status: "skipped" | "deleted" | "error" = "skipped";
    let r2Error: string | null = null;
    if (avatarKey) {
      try {
        const client = r2Client();
        await client.send(
          new DeleteObjectCommand({ Bucket: r2Bucket(), Key: avatarKey }),
        );
        r2Status = "deleted";
      } catch (err) {
        r2Status = "error";
        r2Error = err instanceof Error ? err.message : String(err);
        console.error(`[deleteUserByEmail] R2[${avatarKey}]: ${r2Error}`);
      }
    }

    const summary: RunSummary = {
      email: args.email,
      userId,
      externalId,
      convex: stats,
      betterAuth: baStats,
      r2: { status: r2Status, key: avatarKey, error: r2Error },
    };
    console.info("[deleteUserByEmail] resumen", summary);
    return summary;
  },
});
