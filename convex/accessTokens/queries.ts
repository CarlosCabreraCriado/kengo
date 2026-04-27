import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";

function buildUrl(token: string): string {
  const appUrl = (process.env["APP_URL"] as string) || "https://kengoapp.com";
  return `${appUrl}/magic?t=${token}`;
}

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    const targetId = args.userId;

    const tokens = await ctx.db
      .query("accessTokens")
      .withIndex("by_userId", (q) => q.eq("userId", targetId))
      .collect();

    const data = tokens
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((t) => ({
        id: t._id as string,
        tokenPreview: `...${t.token.slice(-8)}`,
        url: buildUrl(t.token),
        usos_actuales: t.usosActuales,
        usos_maximos: t.usosMaximos ?? null,
        fecha_expiracion: t.fechaExpiracion ?? null,
        date_created: new Date(t._creationTime).toISOString(),
        ultimo_uso: t.ultimoUso ?? null,
        activo: t.activo,
      }));

    return { data };
  },
});

export const getByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accessTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
  },
});
