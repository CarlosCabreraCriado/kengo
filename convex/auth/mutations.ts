import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { LIMITE_FISIOS_AUTOSERVICIO } from "../billing/_helpers";

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

    // B-11: aplicar las MISMAS validaciones que `accessCodes.consume`, que la
    // vía de registro se saltaba (expiración, usos máximos, vínculo por email).
    if (codeDoc.fechaExpiracion && new Date() > new Date(codeDoc.fechaExpiracion)) {
      console.error("[Auth] Código de acceso expirado:", codigoNorm);
      return null;
    }
    if (
      codeDoc.usosMaximos !== undefined &&
      codeDoc.usosActuales >= codeDoc.usosMaximos
    ) {
      console.error("[Auth] Código de acceso agotado:", codigoNorm);
      return null;
    }
    if (
      codeDoc.email &&
      codeDoc.email.toLowerCase() !== normalizedEmail
    ) {
      console.error("[Auth] Código vinculado a otro email:", codigoNorm);
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

    // M-4: si el alta es de un fisio (asiento facturable), respetar el tope de
    // autoservicio. Enterprise se gestiona por ventas; no dejamos que un código
    // suba la cantidad por encima del límite (que Stripe no podría facturar
    // correctamente). Los pacientes no cuentan.
    if (puesto === "fisio") {
      const facturablesActuales = (
        await ctx.db
          .query("clinicMemberships")
          .withIndex("by_clinicId", (q) =>
            q.eq("clinicId", codeDoc.clinicId),
          )
          .collect()
      ).filter(
        (m) => m.puesto === "fisio" || m.puesto === "admin",
      ).length;
      if (facturablesActuales + 1 > LIMITE_FISIOS_AUTOSERVICIO) {
        console.error(
          `[Auth] Alta de fisio bloqueada por tope de autoservicio (clinic=${codeDoc.clinicId}, actuales=${facturablesActuales})`,
        );
        return null;
      }
    }

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

    // B-11: alta facturable → sincronizar la quantity en Stripe, como hacen
    // las demás vías de alta (`accessCodes.consume`, `clinicMemberships.*`).
    if (puesto === "fisio") {
      await ctx.scheduler.runAfter(
        0,
        internal.billing.internal.syncQuantityFromMemberships,
        { clinicId: codeDoc.clinicId },
      );
    }

    return { clinicId: codeDoc.clinicId };
  },
});
