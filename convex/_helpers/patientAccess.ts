/**
 * Helpers compartidos para resolver pacienteId desde diferentes formatos
 * (Convex Id o legacy Directus UUID) y validar acceso del solicitante.
 *
 * Replica el patrón de `records/queries.ts:resolvePacienteId` pero centralizado
 * para reutilización en las queries del nuevo modelo (executions, rollups,
 * snapshots, alerts).
 */

import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { tieneGestion } from "./permissions";

type AnyCtx = QueryCtx | MutationCtx;

/**
 * Convierte un valor opcional `pacienteId` (Convex Id o UUID legacy) a un
 * `Id<"users">`. Si no se pasa, devuelve el `fallbackUserId` (típicamente el
 * usuario autenticado).
 *
 * Convención usada por el frontend legacy: si el string contiene un guion ("-"),
 * lo interpretamos como UUID Directus y lo resolvemos vía `users.by_legacyDirectusId`.
 */
export async function resolvePacienteId(
  ctx: AnyCtx,
  pacienteIdOrUuid: string | undefined,
  fallbackUserId: Id<"users">,
): Promise<Id<"users">> {
  if (!pacienteIdOrUuid) return fallbackUserId;
  if (!pacienteIdOrUuid.includes("-")) {
    return pacienteIdOrUuid as Id<"users">;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_legacyDirectusId", (q) =>
      q.eq("legacyDirectusId", pacienteIdOrUuid),
    )
    .unique();
  return user?._id ?? fallbackUserId;
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
