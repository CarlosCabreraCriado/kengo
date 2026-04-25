import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";

export const toggleFavorite = mutation({
  args: { exerciseId: v.id("exercises") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const existing = await ctx.db
      .query("exerciseFavorites")
      .withIndex("by_userId_exerciseId", (q) =>
        q.eq("userId", user._id).eq("exerciseId", args.exerciseId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { favorito: false };
    }

    await ctx.db.insert("exerciseFavorites", {
      userId: user._id,
      exerciseId: args.exerciseId,
    });

    return { favorito: true };
  },
});
