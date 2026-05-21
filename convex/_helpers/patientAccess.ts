import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { tieneGestion } from "./permissions";
import { assertCanAccessPaciente } from "./authorization";

type AnyCtx = QueryCtx | MutationCtx;

/**
 * @deprecated Usa `resolveAndAssertPacienteId`. Esta función no valida
 * acceso y se mantiene solo para compatibilidad temporal. Su firma se
 * elimina cuando ningún caller la use.
 */
export async function resolvePacienteId(
  _ctx: AnyCtx,
  pacienteId: string | undefined,
  fallbackUserId: Id<"users">,
): Promise<Id<"users">> {
  if (!pacienteId) return fallbackUserId;
  return pacienteId as Id<"users">;
}

/**
 * Resuelve el `pacienteId` a operar (el del argumento si llega, o el del
 * usuario autenticado como fallback) **y valida el acceso**: solo se devuelve
 * el id si el `userId` puede acceder a los datos clínicos de ese paciente
 * según `assertCanAccessPaciente`.
 *
 * Esto sustituye al patrón anterior `resolvePacienteId(...) as Id<"users">`
 * que permitía a cualquier autenticado consultar datos ajenos por IDOR.
 */
export async function resolveAndAssertPacienteId(
  ctx: AnyCtx,
  pacienteId: string | undefined,
  userId: Id<"users">,
): Promise<Id<"users">> {
  const target = (pacienteId ?? userId) as Id<"users">;
  await assertCanAccessPaciente(ctx, userId, target);
  return target;
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
