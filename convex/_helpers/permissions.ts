import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export const PUESTO_FISIOTERAPEUTA = 1;
export const PUESTO_PACIENTE = 2;
export const PUESTO_ADMINISTRADOR = 4;

/**
 * Obtiene el usuario autenticado o lanza un error.
 */
export async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("No autenticado");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", identity.subject))
    .unique();

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  return user;
}

/**
 * Verifica que el usuario tiene un puesto específico en una clínica.
 */
export async function checkClinicPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
  puestosPermitidos: number[],
) {
  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId_clinicId", (q) =>
      q.eq("userId", userId).eq("clinicId", clinicId),
    )
    .unique();

  if (!membership || !puestosPermitidos.includes(membership.puesto)) {
    throw new Error("No tienes permisos para esta acción en esta clínica");
  }

  return membership;
}
