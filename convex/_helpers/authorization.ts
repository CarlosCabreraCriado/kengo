import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "./permissions";

/**
 * Devuelve el plan si el usuario autenticado es su fisioterapeuta.
 * Lanza error si no existe o no tiene permisos.
 */
export async function getPlanIfOwned(
  ctx: QueryCtx | MutationCtx,
  planId: Id<"plans">,
  userId?: Id<"users">,
): Promise<Doc<"plans">> {
  const ownerId = userId ?? (await getAuthenticatedUser(ctx))._id;
  const plan = await ctx.db.get(planId);
  if (!plan) throw new Error("Plan no encontrado");
  if (plan.fisioId !== ownerId) {
    throw new Error("No tienes permisos sobre este plan");
  }
  return plan;
}

/**
 * Devuelve la rutina si el usuario es su autor.
 * Lanza error si no existe o no tiene permisos.
 */
export async function getRoutineIfOwned(
  ctx: QueryCtx | MutationCtx,
  routineId: Id<"routines">,
  userId?: Id<"users">,
): Promise<Doc<"routines">> {
  const ownerId = userId ?? (await getAuthenticatedUser(ctx))._id;
  const routine = await ctx.db.get(routineId);
  if (!routine) throw new Error("Rutina no encontrada");
  if (routine.autorId !== ownerId) {
    throw new Error("No tienes permisos sobre esta rutina");
  }
  return routine;
}

/**
 * Devuelve los IDs de clínicas a las que pertenece un usuario.
 */
export async function getUserClinicIds(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Id<"clinics">[]> {
  const memberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  return memberships.map((m) => m.clinicId);
}

/**
 * Devuelve el conjunto de userIds que comparten al menos una clínica con el usuario dado.
 * Útil para verificar acceso a recursos compartidos por clínica.
 */
export async function getCoworkerUserIds(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Set<Id<"users">>> {
  const clinicIds = await getUserClinicIds(ctx, userId);
  const userIds = new Set<Id<"users">>();
  for (const cId of clinicIds) {
    const members = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", cId))
      .collect();
    for (const m of members) userIds.add(m.userId);
  }
  return userIds;
}
