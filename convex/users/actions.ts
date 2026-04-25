"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSiteUrl(): string {
  return process.env["SITE_URL"]!;
}

/**
 * Crea un paciente completo desde el flujo "añadir paciente" del fisio.
 *
 * Orquesta:
 *  1. Validar email/clínica
 *  2. Crear cuenta Better-Auth (si tiene password) — requireEmailVerification=false
 *  3. Crear/upsert documento `users` + clinicMembership(puesto=2)
 *  4. (opcional) Generar access token (magic link) y devolver URL
 *
 * Idempotente: si el email ya existe en la app, reutiliza el usuario y
 * solo asegura la membresía. El password se omite si la cuenta ya existe.
 */
export const createPatient = action({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    telefono: v.optional(v.string()),
    password: v.optional(v.string()),
    clinicId: v.id("clinics"),
    generateAccessToken: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    code?: string;
    userId?: string;
    accessToken?: { id: string; url: string };
  }> => {
    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    const email = args.email.toLowerCase().trim();

    if (!firstName || !lastName) {
      return { success: false, error: "Nombre y apellidos son obligatorios", code: "DATOS_INVALIDOS" };
    }
    if (!EMAIL_REGEX.test(email)) {
      return { success: false, error: "Email no válido", code: "DATOS_INVALIDOS" };
    }

    // Comprobar si existe en Better-Auth ya
    const exists = await ctx.runQuery(internal.auth.queries.emailExists, { email });

    // Crear cuenta Better-Auth si no existe y se proporciona password
    if (!exists && args.password && args.password.length >= 6) {
      const siteUrl = getSiteUrl();
      const name = `${firstName} ${lastName}`.trim();
      try {
        const res = await fetch(`${siteUrl}/api/auth/sign-up/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: args.password, name }),
        });
        if (!res.ok) {
          const body = await res.text();
          console.error("[createPatient] Better-Auth signup failed:", res.status, body);
          // No abortamos — quizá el usuario ya existe en Better-Auth pero no en app
        }
      } catch (err) {
        console.error("[createPatient] Better-Auth signup error:", err);
      }
    }

    // Upsert usuario + membresía
    const { userId, created } = await ctx.runMutation(
      internal.users.mutations.upsertPatientWithMembership,
      {
        email,
        firstName,
        lastName,
        telefono: args.telefono,
        clinicId: args.clinicId,
      },
    );

    let accessToken: { id: string; url: string } | undefined;

    if (args.generateAccessToken) {
      // Necesitamos el creador (fisio autenticado) para attribuir el token
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("No autenticado");
      const requester = await ctx.runQuery(
        internal.users.internal.getRequesterByExternalId,
        { externalId: identity.subject },
      );
      if (!requester) throw new Error("Usuario fisio no encontrado");

      const result = await ctx.runMutation(
        internal.accessTokens.mutations.getOrCreateForUser,
        {
          pacienteId: userId as Id<"users">,
          creadoPor: requester._id as Id<"users">,
        },
      );
      accessToken = { id: "", url: result.url };
    }

    return {
      success: true,
      userId: userId as string,
      accessToken,
    };
  },
});
