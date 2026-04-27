import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import {
  getAuthenticatedUser,
  checkClinicPermission,
  PUESTO_FISIOTERAPEUTA,
  PUESTO_ADMINISTRADOR,
} from "../_helpers/permissions";

export const create = mutation({
  args: {
    clinicId: v.id("clinics"),
    tipo: v.union(v.literal("fisioterapeuta"), v.literal("paciente")),
    usosMaximos: v.optional(v.number()),
    fechaExpiracion: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await checkClinicPermission(ctx, user._id, args.clinicId, [
      PUESTO_FISIOTERAPEUTA,
      PUESTO_ADMINISTRADOR,
    ]);

    const codigo = generateRandomCode(8);

    const codeId = await ctx.db.insert("accessCodes", {
      clinicId: args.clinicId,
      codigo,
      tipo: args.tipo,
      activo: true,
      usosMaximos: args.usosMaximos,
      usosActuales: 0,
      fechaExpiracion: args.fechaExpiracion,
      email: args.email,
      creadoPor: user._id,
    });

    return { codeId, codigo };
  },
});

export const consume = mutation({
  args: {
    codigo: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const codigoNorm = args.codigo.trim().toUpperCase();

    // Buscar codigo
    const codeDoc = await ctx.db
      .query("accessCodes")
      .withIndex("by_codigo", (q) => q.eq("codigo", codigoNorm))
      .unique();

    if (!codeDoc) {
      throw new ConvexError({ code: "CODIGO_NO_ENCONTRADO", message: "El código no existe" });
    }

    // Validar activo
    if (!codeDoc.activo) {
      throw new ConvexError({ code: "CODIGO_INACTIVO", message: "El código ha sido desactivado" });
    }

    // Validar expiracion
    if (codeDoc.fechaExpiracion) {
      const ahora = new Date();
      const expiracion = new Date(codeDoc.fechaExpiracion);
      if (ahora > expiracion) {
        throw new ConvexError({ code: "CODIGO_EXPIRADO", message: "El código ha expirado" });
      }
    }

    // Validar usos
    if (codeDoc.usosMaximos !== undefined && codeDoc.usosActuales >= codeDoc.usosMaximos) {
      throw new ConvexError({ code: "CODIGO_AGOTADO", message: "El código ha alcanzado el límite de usos" });
    }

    // Validar email si el codigo esta vinculado a uno especifico
    if (codeDoc.email) {
      if (user.email.toLowerCase() !== codeDoc.email.toLowerCase()) {
        throw new ConvexError({ code: "EMAIL_NO_COINCIDE", message: "Este código está vinculado a otro email" });
      }
    }

    // Verificar si ya es miembro de la clinica
    const existingMembership = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", user._id).eq("clinicId", codeDoc.clinicId),
      )
      .unique();

    if (existingMembership) {
      throw new ConvexError({ code: "YA_VINCULADO", message: "Ya estás vinculado a esta clínica" });
    }

    const puesto: "fisio" | "paciente" =
      codeDoc.tipo === "fisioterapeuta" ? "fisio" : "paciente";

    await ctx.db.insert("clinicMemberships", {
      userId: user._id,
      clinicId: codeDoc.clinicId,
      puesto,
    });

    await ctx.db.patch(codeDoc._id, {
      usosActuales: codeDoc.usosActuales + 1,
    });

    const clinic = await ctx.db.get(codeDoc.clinicId);

    return {
      clinicId: codeDoc.clinicId,
      nombreClinica: clinic?.nombre ?? "",
      tipo: codeDoc.tipo,
    };
  },
});

export const deactivate = mutation({
  args: { codeId: v.id("accessCodes") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    await ctx.db.patch(args.codeId, { activo: false });
  },
});

export const reactivate = mutation({
  args: { codeId: v.id("accessCodes") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    await ctx.db.patch(args.codeId, { activo: true });
  },
});

function generateRandomCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
