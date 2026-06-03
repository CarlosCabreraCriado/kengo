import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  PUESTOS_GESTION,
  tieneGestion,
} from "../_helpers/permissions";
import { assertCanAccessPaciente } from "../_helpers/authorization";
import { membershipEsPaciente } from "../_helpers/patientAccess";

/**
 * Lista membresías de un usuario con datos de clínica anidados.
 *
 * Si `userId` se pasa y no coincide con el solicitante, exige que ambos
 * compartan al menos una clínica donde el solicitante tenga rol de gestión
 * sobre ese usuario (paciente). Esto cierra el IDOR que permitía a cualquier
 * autenticado descubrir las membresías de un id ajeno.
 */
export const listByUser = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const requester = await getAuthenticatedUser(ctx);
    const userId = args.userId ?? requester._id;

    if (userId !== requester._id) {
      // Reutilizamos la validación canónica: el solicitante debe ser
      // fisio/admin en alguna clínica donde `userId` figure como paciente.
      // Para targets fisio/admin no abrimos paso aquí — los flujos UI no lo
      // requieren.
      await assertCanAccessPaciente(ctx, requester._id, userId);
    }

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const enriched = await Promise.all(
      memberships.map(async (m) => {
        const clinic = await ctx.db.get(m.clinicId);
        return {
          _id: m._id,
          userId,
          clinicId: m.clinicId,
          puesto: m.puesto,
          nombreClinica: clinic?.nombre ?? null,
        };
      }),
    );

    return enriched;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// getClinicIdForResource
//
// Alimenta al `ClinicaActivaResourceGuard` del frontend. Dado el tipo de
// recurso y su id (extraído de la URL), devuelve la clínica a la que
// pertenece — para que el guard pueda hacer auto-switch de la clínica activa
// sin que el usuario quede viendo datos de una clínica B con la A marcada
// como activa.
//
// No lanza errores: siempre devuelve `{ clinicId, accesible }` para que el
// guard pueda redirigir limpio. Si `accesible === false`, el guard envía al
// /inicio. Si `clinicId === null` con `accesible === true` significa que el
// recurso es legacy (sin clinicId) y no requiere switch.
// ─────────────────────────────────────────────────────────────────────────────

async function userIsMemberOfClinic(
  ctx: any,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
): Promise<Doc<"clinicMemberships"> | null> {
  return await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId_clinicId", (q: any) =>
      q.eq("userId", userId).eq("clinicId", clinicId),
    )
    .unique();
}

async function resolvePacienteClinic(
  ctx: any,
  requesterId: Id<"users">,
  pacienteId: Id<"users">,
): Promise<Id<"clinics"> | null> {
  // El propio paciente: devolvemos su primera clínica como paciente. Para
  // fisios/admins que actúan como sus propios pacientes, cuenta también la
  // clínica donde tienen `tambienEsPaciente`.
  if (requesterId === pacienteId) {
    const own = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q: any) => q.eq("userId", requesterId))
      .collect();
    return own.find((m: any) => membershipEsPaciente(m))?.clinicId ?? null;
  }

  // Fisio/admin accediendo a un paciente: primera clínica donde el
  // solicitante tiene gestión y el paciente es miembro como paciente.
  const myMemberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q: any) => q.eq("userId", requesterId))
    .collect();
  const myManagedClinicIds = myMemberships
    .filter((m: any) => tieneGestion(m.puesto))
    .map((m: any) => m.clinicId as Id<"clinics">);

  for (const clinicId of myManagedClinicIds) {
    const pacienteEnClinica = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q: any) =>
        q.eq("userId", pacienteId).eq("clinicId", clinicId),
      )
      .unique();
    if (membershipEsPaciente(pacienteEnClinica)) {
      return clinicId;
    }
  }
  return null;
}

type ResourceLookup = {
  clinicId: Id<"clinics"> | null;
  clinicName: string | null;
  accesible: boolean;
};

async function withClinicName(
  ctx: any,
  clinicId: Id<"clinics"> | null,
  accesible: boolean,
): Promise<ResourceLookup> {
  if (!clinicId) return { clinicId: null, clinicName: null, accesible };
  const clinic = await ctx.db.get(clinicId);
  return { clinicId, clinicName: clinic?.nombre ?? null, accesible };
}

export const getClinicIdForResource = query({
  args: {
    resourceType: v.union(
      v.literal("paciente"),
      v.literal("plan"),
      v.literal("sesion"),
      v.literal("conversacion"),
    ),
    resourceId: v.string(),
  },
  handler: async (ctx, args): Promise<ResourceLookup> => {
    const user = await getAuthenticatedUser(ctx);
    const denegado: ResourceLookup = {
      clinicId: null,
      clinicName: null,
      accesible: false,
    };

    switch (args.resourceType) {
      case "paciente": {
        const pacienteId = args.resourceId as Id<"users">;
        const paciente = await ctx.db.get(pacienteId);
        if (!paciente) return denegado;
        const clinicId = await resolvePacienteClinic(
          ctx,
          user._id,
          pacienteId,
        );
        if (!clinicId) return denegado;
        return await withClinicName(ctx, clinicId, true);
      }

      case "plan": {
        const planId = args.resourceId as Id<"plans">;
        const plan = await ctx.db.get(planId);
        if (!plan) return denegado;

        if (plan.clinicId) {
          const membership = await userIsMemberOfClinic(
            ctx,
            user._id,
            plan.clinicId,
          );
          if (!membership) return denegado;
          // Restricción adicional: si no es el propio paciente, el solicitante
          // debe tener rol de gestión en esa clínica (alineado con
          // `assertCanAccessPlan`).
          if (
            user._id !== plan.pacienteId &&
            !PUESTOS_GESTION.includes(membership.puesto)
          ) {
            return denegado;
          }
          return await withClinicName(ctx, plan.clinicId, true);
        }

        // Plan legacy sin clinicId: caer al criterio por paciente.
        const fallbackClinic = await resolvePacienteClinic(
          ctx,
          user._id,
          plan.pacienteId,
        );
        if (!fallbackClinic) return denegado;
        return await withClinicName(ctx, fallbackClinic, true);
      }

      case "sesion": {
        const sessionId = args.resourceId as Id<"sessions">;
        const session = await ctx.db.get(sessionId);
        if (!session) return denegado;

        if (user._id === session.pacienteId) {
          return await withClinicName(ctx, session.clinicId, true);
        }
        const membership = await userIsMemberOfClinic(
          ctx,
          user._id,
          session.clinicId,
        );
        if (!membership || !PUESTOS_GESTION.includes(membership.puesto)) {
          return denegado;
        }
        return await withClinicName(ctx, session.clinicId, true);
      }

      case "conversacion": {
        const conversationId = args.resourceId as Id<"conversations">;
        const conv = await ctx.db.get(conversationId);
        if (!conv) return denegado;
        if (conv.pacienteId !== user._id && conv.fisioId !== user._id) {
          return denegado;
        }
        return await withClinicName(ctx, conv.clinicId, true);
      }
    }
  },
});
