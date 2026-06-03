import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

// ─── RECOVERY CODES ───

export const createRecoveryCode = internalMutation({
  args: {
    email: v.string(),
    codigo: v.string(),
    expiration: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("recoveryCodes", {
      email: args.email.toLowerCase().trim(),
      codigo: args.codigo,
      expiration: args.expiration,
      usado: false,
      intentos_fallidos: 0,
    });
  },
});

export const validateAndConsumeRecoveryCode = internalMutation({
  args: {
    email: v.string(),
    codigo: v.string(),
  },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();

    // Buscar el código más reciente no usado para este email
    const codes = await ctx.db
      .query("recoveryCodes")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .order("desc")
      .take(10);

    const code = codes.find((c) => !c.usado);

    if (!code) {
      return { valid: false, error: "CODIGO_INVALIDO" as const };
    }

    // Verificar expiración
    if (new Date(code.expiration) < new Date()) {
      return { valid: false, error: "CODIGO_EXPIRADO" as const };
    }

    // Verificar intentos agotados
    if (code.intentos_fallidos >= 3) {
      return { valid: false, error: "INTENTOS_AGOTADOS" as const };
    }

    // Verificar código correcto
    if (code.codigo !== args.codigo) {
      await ctx.db.patch(code._id, {
        intentos_fallidos: code.intentos_fallidos + 1,
      });
      return { valid: false, error: "CODIGO_INVALIDO" as const };
    }

    // Código válido: marcar como usado
    await ctx.db.patch(code._id, { usado: true });
    return { valid: true, error: null };
  },
});

// ─── VERIFICATION CODES ───

export const createVerificationCode = internalMutation({
  args: {
    userId: v.id("users"),
    codigo: v.string(),
    expiration: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("verificationCodes", {
      userId: args.userId,
      codigo: args.codigo,
      expiration: args.expiration,
      usado: false,
      intentos_fallidos: 0,
    });
  },
});

export const validateAndConsumeVerificationCode = internalMutation({
  args: {
    userId: v.id("users"),
    codigo: v.string(),
  },
  handler: async (ctx, args) => {
    const codes = await ctx.db
      .query("verificationCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);

    const code = codes.find((c) => !c.usado);

    if (!code) {
      return { valid: false, error: "CODIGO_INVALIDO" as const };
    }

    if (new Date(code.expiration) < new Date()) {
      return { valid: false, error: "CODIGO_EXPIRADO" as const };
    }

    if (code.intentos_fallidos >= 3) {
      return { valid: false, error: "INTENTOS_AGOTADOS" as const };
    }

    if (code.codigo !== args.codigo) {
      await ctx.db.patch(code._id, {
        intentos_fallidos: code.intentos_fallidos + 1,
      });
      return { valid: false, error: "CODIGO_INVALIDO" as const };
    }

    await ctx.db.patch(code._id, { usado: true });
    return { valid: true, error: null };
  },
});

// ─── USER EMAIL VERIFICATION ───

export const markEmailVerified = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { emailVerified: true });
  },
});

// ─── MEMBERSHIP FROM ACCESS CODE (for registration flow) ───

export const createMembershipFromCode = internalMutation({
  args: {
    userEmail: v.string(),
    codigoClinuca: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.userEmail.toLowerCase().trim();

    // Buscar el usuario por email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (!user) {
      console.error("[Auth] Usuario no encontrado para crear membresía:", normalizedEmail);
      return null;
    }

    // Buscar el código de acceso
    const codigoNorm = args.codigoClinuca.trim().toUpperCase();
    const codeDoc = await ctx.db
      .query("accessCodes")
      .withIndex("by_codigo", (q) => q.eq("codigo", codigoNorm))
      .unique();

    if (!codeDoc || !codeDoc.activo) {
      console.error("[Auth] Código de acceso no válido:", codigoNorm);
      return null;
    }

    // Verificar que el usuario no está ya vinculado
    const existingMembership = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", user._id).eq("clinicId", codeDoc.clinicId),
      )
      .unique();

    if (existingMembership) {
      return { clinicId: codeDoc.clinicId };
    }

    // El puesto se deriva del propio código de acceso (fuente de verdad)
    const puesto: "fisio" | "paciente" =
      codeDoc.tipo === "fisioterapeuta" ? "fisio" : "paciente";

    // Crear membresía. Los fisios actúan también como sus propios pacientes.
    await ctx.db.insert("clinicMemberships", {
      userId: user._id,
      clinicId: codeDoc.clinicId,
      puesto,
      tambienEsPaciente: puesto === "fisio" ? true : undefined,
    });

    // Incrementar usos del código
    await ctx.db.patch(codeDoc._id, {
      usosActuales: codeDoc.usosActuales + 1,
    });

    return { clinicId: codeDoc.clinicId };
  },
});
