import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";

function buildUrl(token: string): string {
  const appUrl = (process.env["APP_URL"] as string) || "https://kengoapp.com";
  return `${appUrl}/magic?t=${token}`;
}

// Resuelve un userId que puede ser UUID legacy o Convex Id.
async function resolveUserId(
  ctx: any,
  idOrUuid: string,
): Promise<Id<"users"> | null> {
  if (!idOrUuid.includes("-")) {
    return idOrUuid as Id<"users">;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_legacyDirectusId", (q: any) =>
      q.eq("legacyDirectusId", idOrUuid),
    )
    .unique();
  return user?._id ?? null;
}

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    const targetId = await resolveUserId(ctx, args.userId);
    if (!targetId) return { data: [] as any[] };

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
