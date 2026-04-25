import { v } from "convex/values";
import { mutation } from "../_generated/server";
import {
  getAuthenticatedUser,
  checkClinicPermission,
  PUESTO_ADMINISTRADOR,
} from "../_helpers/permissions";

export const create = mutation({
  args: {
    nombre: v.string(),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    direccion: v.optional(v.string()),
    postal: v.optional(v.string()),
    nif: v.optional(v.string()),
    colorPrimario: v.optional(v.string()),
    colorSecundario: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const clinicId = await ctx.db.insert("clinics", {
      nombre: args.nombre,
      telefono: args.telefono,
      email: args.email,
      direccion: args.direccion,
      postal: args.postal,
      nif: args.nif,
      colorPrimario: args.colorPrimario,
      colorSecundario: args.colorSecundario,
      createdBy: user._id,
    });

    await ctx.db.insert("clinicMemberships", {
      userId: user._id,
      clinicId,
      puesto: PUESTO_ADMINISTRADOR,
    });

    return clinicId;
  },
});

export const update = mutation({
  args: {
    clinicId: v.id("clinics"),
    nombre: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    direccion: v.optional(v.string()),
    postal: v.optional(v.string()),
    nif: v.optional(v.string()),
    colorPrimario: v.optional(v.string()),
    colorSecundario: v.optional(v.string()),
    // R2 key (`logos/<uuid>.<ext>`) o null para eliminar el logo.
    logo: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await checkClinicPermission(ctx, user._id, args.clinicId, [
      PUESTO_ADMINISTRADOR,
    ]);

    const { clinicId, ...fields } = args;
    // Patch solo de campos provistos. `null` se traduce a undefined para borrar
    // el campo opcional del documento (Convex no acepta null en v.optional).
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      patch[key] = value === null ? undefined : value;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(clinicId, patch);
    }
  },
});
