import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export const getRequesterByExternalId = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
  },
});

export const resolveUser = internalQuery({
  args: { idOrUuid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.idOrUuid as Id<"users">);
  },
});
