import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { tieneGestion } from "./permissions";

type AnyCtx = QueryCtx | MutationCtx;

export async function resolvePacienteId(
  _ctx: AnyCtx,
  pacienteId: string | undefined,
  fallbackUserId: Id<"users">,
): Promise<Id<"users">> {
  if (!pacienteId) return fallbackUserId;
  return pacienteId as Id<"users">;
}

/**
 * Verifica que el usuario es fisio o admin en la clínica indicada. Lanza
 * error si no tiene acceso. Patrón usado por las queries del dashboard /
 * tabla pacientes / bandeja de alertas.
 */
export async function assertFisioInClinic(
  ctx: AnyCtx,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
): Promise<void> {
  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId_clinicId", (q) =>
      q.eq("userId", userId).eq("clinicId", clinicId),
    )
    .unique();
  if (!membership || !tieneGestion(membership.puesto)) {
    throw new Error("No tienes acceso a esta clínica");
  }
}

/**
 * Devuelve las clínicas en las que el usuario tiene rol de gestión (fisio o
 * admin). Útil para listar alertas/datos del fisio actual.
 */
export async function getManagedClinicIds(
  ctx: AnyCtx,
  userId: Id<"users">,
): Promise<Id<"clinics">[]> {
  const memberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  return memberships.filter((m) => tieneGestion(m.puesto)).map((m) => m.clinicId);
}
