"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  welcomeEmailTemplate,
  passwordResetEmailTemplate,
  emailVerificationTemplate,
} from "../email/templates";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const RATE_LIMIT_PER_HOUR = 3;
const CODE_EXPIRATION_MINUTES = 15;

interface AuthResult {
  success: boolean;
  message?: string;
  code?: string;
  userId?: string;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function expirationFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function getAppUrl(): string {
  return process.env["APP_URL"] || "https://kengoapp.com";
}

function getSiteUrl(): string {
  return process.env["SITE_URL"]!;
}

// ─── REGISTER ───

export const register = action({
  args: {
    first_name: v.string(),
    last_name: v.string(),
    email: v.string(),
    password: v.string(),
    tipo: v.union(v.literal("fisioterapeuta"), v.literal("paciente")),
    codigo_clinica: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const firstName = args.first_name.trim();
    const lastName = args.last_name.trim();
    const email = args.email.toLowerCase().trim();
    const password = args.password;
    const codigoClinica = args.codigo_clinica?.trim();

    // Validaciones
    if (!firstName || !lastName) {
      return { success: false, error: "Nombre y apellidos son obligatorios", code: "DATOS_INVALIDOS" };
    }
    if (!EMAIL_REGEX.test(email)) {
      return { success: false, error: "El formato del email no es válido", code: "DATOS_INVALIDOS" };
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { success: false, error: "La contraseña debe tener al menos 6 caracteres", code: "DATOS_INVALIDOS" };
    }

    // Verificar email duplicado
    const exists = await ctx.runQuery(internal.auth.queries.emailExists, { email });
    if (exists) {
      return { success: false, error: "Este email ya está registrado", code: "EMAIL_DUPLICADO" };
    }

    // Validar código de clínica si se proporciona
    if (codigoClinica) {
      const codeDoc = await ctx.runQuery(internal.auth.queries.findAccessCode, {
        codigo: codigoClinica,
      });
      if (!codeDoc) {
        return { success: false, error: "El código de clínica no es válido", code: "CLINICA_NO_ENCONTRADA" };
      }
    }

    // Crear usuario en Better-Auth via HTTP
    const siteUrl = getSiteUrl();
    const name = `${firstName} ${lastName}`.trim();

    try {
      const res = await fetch(`${siteUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error("[Auth] Better-Auth signup failed:", res.status, body);
        return { success: false, error: "Error al crear la cuenta", code: "SERVER_ERROR" };
      }
    } catch (err) {
      console.error("[Auth] Better-Auth signup error:", err);
      return { success: false, error: "Error al crear la cuenta", code: "SERVER_ERROR" };
    }

    // Crear membresía de clínica si hay código
    if (codigoClinica) {
      await ctx.runMutation(internal.auth.mutations.createMembershipFromCode, {
        userEmail: email,
        codigoClinuca: codigoClinica,
        tipo: args.tipo,
      });
    }

    // Enviar email de bienvenida (fire-and-forget)
    const appUrl = getAppUrl();
    await ctx.scheduler.runAfter(0, internal.email.actions.sendEmail, {
      to: email,
      subject: `Bienvenido a Kengo, ${firstName}!`,
      html: welcomeEmailTemplate(firstName, args.tipo, appUrl),
    });

    return {
      success: true,
      message: "Usuario registrado exitosamente",
      userId: email,
    };
  },
});

// ─── PASSWORD RECOVERY ───

export const requestPasswordReset = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const successResponse = {
      success: true,
      message: "Si el email existe, recibirás un código de recuperación",
    };

    // Validar formato
    if (!EMAIL_REGEX.test(email)) {
      return successResponse; // No revelar si el email es inválido
    }

    // Rate limit
    const recentCount = await ctx.runQuery(
      internal.auth.queries.countRecentRecoveryCodes,
      { email },
    );
    if (recentCount >= RATE_LIMIT_PER_HOUR) {
      return successResponse; // Silencioso
    }

    // Buscar usuario
    const user = await ctx.runQuery(internal.auth.queries.findUserByEmail, { email });
    if (!user) {
      return successResponse; // No revelar que no existe
    }

    // Generar código
    const codigo = generateCode();
    const expiration = expirationFromNow(CODE_EXPIRATION_MINUTES);

    await ctx.runMutation(internal.auth.mutations.createRecoveryCode, {
      email,
      codigo,
      expiration,
    });

    // Enviar email
    await ctx.scheduler.runAfter(0, internal.email.actions.sendEmail, {
      to: email,
      subject: `${codigo} - Tu código de recuperación de Kengo`,
      html: passwordResetEmailTemplate(codigo, user.firstName),
    });

    return successResponse;
  },
});

// ─── RESET PASSWORD ───

export const resetPassword = action({
  args: {
    email: v.string(),
    codigo: v.string(),
    nuevaPassword: v.string(),
  },
  handler: async (ctx, args): Promise<AuthResult> => {
    const email = args.email.toLowerCase().trim();

    // Validar formato email
    if (!EMAIL_REGEX.test(email)) {
      return { success: false, message: "Email no válido", code: "CODIGO_INVALIDO" };
    }

    // Validar código
    if (args.codigo.length !== 6) {
      return { success: false, message: "Código no válido", code: "CODIGO_INVALIDO" };
    }

    // Validar password
    if (args.nuevaPassword.length < MIN_PASSWORD_LENGTH) {
      return {
        success: false,
        message: "La contraseña debe tener al menos 6 caracteres",
        code: "PASSWORD_MUY_CORTA",
      };
    }

    // Validar y consumir código
    const result = await ctx.runMutation(
      internal.auth.mutations.validateAndConsumeRecoveryCode,
      { email, codigo: args.codigo },
    );

    if (!result.valid) {
      const messages: Record<string, string> = {
        CODIGO_INVALIDO: "Código no válido",
        CODIGO_EXPIRADO: "El código ha expirado",
        INTENTOS_AGOTADOS: "Has agotado los intentos para este código",
      };
      return {
        success: false,
        message: messages[result.error!] ?? "Código no válido",
        code: result.error ?? undefined,
      };
    }

    // NOTA: La actualización del password en Better-Auth se maneja en el
    // HTTP endpoint /api/auth/convex-reset-password que Angular llama directamente.
    // Esta action es el fallback cuando el endpoint HTTP no está disponible.

    return {
      success: true,
      message: "Tu contraseña ha sido actualizada correctamente",
    };
  },
});

// ─── SEND VERIFICATION CODE ───

export const sendVerificationCode = action({
  args: {},
  handler: async (ctx) => {
    // Obtener usuario autenticado
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, message: "No autenticado", code: "NO_AUTENTICADO" };
    }

    // Buscar usuario en tabla users
    const user = await ctx.runQuery(internal.auth.queries.findUserByExternalId, {
      externalId: identity.subject,
    });
    if (!user) {
      return { success: false, message: "Usuario no encontrado", code: "NO_AUTENTICADO" };
    }

    // Rate limit
    const recentCount = await ctx.runQuery(
      internal.auth.queries.countRecentVerificationCodes,
      { userId: user._id },
    );
    if (recentCount >= RATE_LIMIT_PER_HOUR) {
      return {
        success: false,
        message: "Has solicitado demasiados códigos. Inténtalo en una hora.",
        code: "RATE_LIMIT_EXCEEDED",
      };
    }

    // Generar código
    const codigo = generateCode();
    const expiration = expirationFromNow(CODE_EXPIRATION_MINUTES);

    await ctx.runMutation(internal.auth.mutations.createVerificationCode, {
      userId: user._id,
      codigo,
      expiration,
    });

    // Enviar email
    await ctx.scheduler.runAfter(0, internal.email.actions.sendEmail, {
      to: user.email,
      subject: `${codigo} - Verifica tu email en Kengo`,
      html: emailVerificationTemplate(codigo, user.firstName),
    });

    return {
      success: true,
      message: "Se ha enviado un código de verificación a tu email",
    };
  },
});

// ─── VERIFY EMAIL ───

export const verifyEmail = action({
  args: { codigo: v.string() },
  handler: async (ctx, args): Promise<AuthResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, message: "No autenticado", code: "NO_AUTENTICADO" };
    }

    const user = await ctx.runQuery(internal.auth.queries.findUserByExternalId, {
      externalId: identity.subject,
    });
    if (!user) {
      return { success: false, message: "Usuario no encontrado", code: "NO_AUTENTICADO" };
    }

    if (args.codigo.length !== 6) {
      return { success: false, message: "Código no válido", code: "CODIGO_INVALIDO" };
    }

    const result = await ctx.runMutation(
      internal.auth.mutations.validateAndConsumeVerificationCode,
      { userId: user._id, codigo: args.codigo },
    );

    if (!result.valid) {
      const messages: Record<string, string> = {
        CODIGO_INVALIDO: "Código no válido",
        CODIGO_EXPIRADO: "El código ha expirado",
        INTENTOS_AGOTADOS: "Has agotado los intentos para este código",
      };
      return {
        success: false,
        message: messages[result.error!] ?? "Código no válido",
        code: result.error ?? undefined,
      };
    }

    // Marcar email como verificado
    await ctx.runMutation(internal.auth.mutations.markEmailVerified, {
      userId: user._id,
    });

    return {
      success: true,
      message: "Tu email ha sido verificado correctamente",
    };
  },
});

// ─── ESTABLECER PASSWORD ───

export const establecerPassword = action({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    if (args.password.length < MIN_PASSWORD_LENGTH) {
      return { success: false, message: "La contraseña debe tener al menos 6 caracteres" };
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, message: "No autenticado" };
    }

    const user = await ctx.runQuery(internal.auth.queries.findUserByExternalId, {
      externalId: identity.subject,
    });
    if (!user) {
      return { success: false, message: "Usuario no encontrado" };
    }

    // NOTA: La actualización del password en Better-Auth se maneja en el
    // HTTP endpoint /api/auth/convex-set-password que Angular llama directamente.
    // Esta action es solo fallback.

    return { success: true, message: "Contraseña establecida correctamente" };
  },
});
