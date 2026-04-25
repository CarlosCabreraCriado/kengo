import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";

export const getForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return await ctx.db
      .query("userDetails")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
  },
});

export const upsertForCurrentUser = mutation({
  args: {
    dni: v.optional(v.string()),
    fechaNacimiento: v.optional(v.string()),
    sexo: v.optional(v.string()),
    direccion: v.optional(v.string()),
    postal: v.optional(v.string()),
    telefono: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const existing = await ctx.db
      .query("userDetails")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    const payload = {
      userId: user._id,
      dni: args.dni,
      fechaNacimiento: args.fechaNacimiento,
      sexo: args.sexo,
      direccion: args.direccion,
      postal: args.postal,
      telefono: args.telefono,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("userDetails", payload);
  },
});
