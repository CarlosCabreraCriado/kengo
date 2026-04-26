import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";

/**
 * Devuelve los datos personales del usuario actual (consolidados en `users`).
 * Mantiene fallback a la tabla deprecada `userDetails` para datos pre-migración.
 */
export const getForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const fromUser = {
      dni: user.dni,
      fechaNacimiento: user.fechaNacimiento,
      sexo: user.sexo,
      direccion: user.direccion,
      postal: user.postal,
      telefono: user.telefono,
    };

    if (Object.values(fromUser).some((v) => v !== undefined)) {
      return { _id: user._id, userId: user._id, ...fromUser };
    }

    const legacy = await ctx.db
      .query("userDetails")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    return legacy;
  },
});

/**
 * Escribe los datos personales en `users` directamente. La tabla deprecada
 * `userDetails` ya no se usa para nuevos datos.
 */
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

    const patch: Record<string, unknown> = {};
    if (args.dni !== undefined) patch["dni"] = args.dni;
    if (args.fechaNacimiento !== undefined)
      patch["fechaNacimiento"] = args.fechaNacimiento;
    if (args.sexo !== undefined) patch["sexo"] = args.sexo;
    if (args.direccion !== undefined) patch["direccion"] = args.direccion;
    if (args.postal !== undefined) patch["postal"] = args.postal;
    if (args.telefono !== undefined) patch["telefono"] = args.telefono;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }
    return user._id;
  },
});
