"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSiteUrl(): string {
  return process.env["SITE_URL"]!;
}

function getAppUrl(): string {
  return process.env["APP_URL"] || "https://kengoapp.com";
}

/**
 * Crea un paciente completo desde el flujo "añadir paciente" del fisio.
 *
 * Orquesta:
 *  1. Validar email/clínica
 *  2. Crear cuenta Better-Auth (si tiene password) — requireEmailVerification=false
 *  3. Crear/upsert documento `users` + clinicMembership(puesto=paciente)
 *  4. Auto-asignar al fisio creador como responsable
 *  5. Generar magic link (access token, 30 días) y código de acceso nominal
 *     (accessCode tipo paciente, email vinculado, 1 uso, 30 días)
 *  6. Enviar email al paciente con ambos
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
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    code?: string;
    userId?: string;
    accessToken?: { id: string; url: string };
    codigoAcceso?: string;
    emailEnviado?: boolean;
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
        // Origin requerido por el plugin crossDomain de Better-Auth: las
        // llamadas server-to-server desde Node no añaden Origin automáticamente.
        const res = await fetch(`${siteUrl}/api/auth/sign-up/email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: getAppUrl(),
          },
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

    // Resolver el fisio creador (autenticado) — necesario tanto para
    // autoasignación como para attribuir el access token.
    const identity = await ctx.auth.getUserIdentity();
    const requester = identity
      ? await ctx.runQuery(
          internal.users.internal.getRequesterByExternalId,
          { externalId: identity.subject },
        )
      : null;

    // Auto-asignar al fisio creador como responsable del paciente en la
    // clínica primaria. La asignación es idempotente; si falla por cualquier
    // razón (red, permisos), no abortamos la creación: el fisio puede
    // arreglarlo desde /mis-pacientes/asignacion.
    if (requester) {
      try {
        await ctx.runMutation(api.assignments.mutations.assign, {
          pacienteId: userId as Id<"users">,
          fisioId: requester._id as Id<"users">,
          clinicId: args.clinicId,
        });
      } catch (err) {
        console.warn("[createPatient] auto-assign failed:", err);
      }
    }

    if (!requester) throw new Error("Usuario fisio no encontrado");

    // Magic link de 30 días: el paciente entra sin contraseña.
    const tokenResult = await ctx.runMutation(
      internal.accessTokens.mutations.getOrCreateForUser,
      {
        pacienteId: userId as Id<"users">,
        creadoPor: requester._id as Id<"users">,
      },
    );
    const accessToken = { id: "", url: tokenResult.url };

    // Código de acceso nominal (1 uso, 30 días, vinculado al email del
    // paciente) — alternativa al magic link si el paciente prefiere
    // registrarse manualmente o pierde el enlace.
    const expiracion = new Date();
    expiracion.setDate(expiracion.getDate() + 30);
    let codigoAcceso: string | undefined;
    try {
      const codigoResult = await ctx.runMutation(
        api.accessCodes.mutations.create,
        {
          clinicId: args.clinicId,
          tipo: "paciente",
          email,
          fechaExpiracion: expiracion.toISOString(),
        },
      );
      codigoAcceso = codigoResult.codigo;
    } catch (err) {
      console.warn("[createPatient] generación de código falló:", err);
    }

    // Enviar email al paciente con magic link + código. Fire-and-forget:
    // si el envío falla, no abortamos la creación.
    let emailEnviado = false;
    if (codigoAcceso) {
      try {
        const clinica = await ctx.runQuery(
          internal.clinics.internal.getById,
          { clinicId: args.clinicId },
        );
        const nombreFisio = `${requester.firstName ?? ""} ${requester.lastName ?? ""}`.trim();
        emailEnviado = await ctx.runAction(
          internal.email.actions.sendPatientInvitationEmail,
          {
            to: email,
            nombre: firstName,
            accessUrl: accessToken.url,
            codigo: codigoAcceso,
            nombreFisio: nombreFisio || undefined,
            nombreClinica: clinica?.nombre || undefined,
          },
        );
      } catch (err) {
        console.warn("[createPatient] envío de email falló:", err);
      }
    }

    return {
      success: true,
      userId: userId as string,
      accessToken,
      codigoAcceso,
      emailEnviado,
    };
  },
});
