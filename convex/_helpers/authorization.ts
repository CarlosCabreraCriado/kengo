import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  Puesto,
  PUESTOS_GESTION,
  tieneGestion,
} from "./permissions";

type AnyCtx = QueryCtx | MutationCtx;

/**
 * Devuelve la rutina si el usuario es su autor.
 * Lanza error si no existe o no tiene permisos.
 */
export async function getRoutineIfOwned(
  ctx: AnyCtx,
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
  ctx: AnyCtx,
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
  ctx: AnyCtx,
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

// ─────────────────────────────────────────────────────────────────────────────
// Validaciones de acceso multiclinica
//
// El backend Convex no tiene RBAC nativo: la única defensa es a nivel de
// query/mutation. Estos helpers se aplican al principio de cada handler de un
// endpoint que recibe un ID de recurso desde el cliente. Lanzan un error
// claro ("No tienes acceso a ...") cuando la petición cruza fronteras de
// clínica.
//
// Convención: cuando se requieren puestos concretos, se pasa un array. Si se
// omite, basta con cualquier membresía.
// ─────────────────────────────────────────────────────────────────────────────

const ERR_NO_ACCESO = "No tienes acceso a este recurso";

/**
 * Lanza si `userId` no es miembro de `clinicId` con un puesto aceptado.
 * Devuelve la membresía si todo va bien.
 */
export async function assertCanAccessClinic(
  ctx: AnyCtx,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
  puestos: readonly Puesto[] = ["fisio", "paciente", "admin"],
): Promise<Doc<"clinicMemberships">> {
  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId_clinicId", (q) =>
      q.eq("userId", userId).eq("clinicId", clinicId),
    )
    .unique();
  if (!membership || !puestos.includes(membership.puesto)) {
    throw new Error(ERR_NO_ACCESO);
  }
  return membership;
}

/**
 * Lanza si `userId` no puede acceder a los datos clínicos de `pacienteId`.
 * Se permite el acceso cuando:
 *   - `userId === pacienteId` (el propio paciente consulta lo suyo).
 *   - existe al menos una clínica donde `pacienteId` figura como paciente y
 *     `userId` figura como fisio o admin (la relación profesional vigente).
 *
 * IMPORTANTE: ser solo "compañeros de clínica" no es suficiente; el usuario
 * debe tener rol de gestión sobre el paciente en alguna clínica común.
 */
export async function assertCanAccessPaciente(
  ctx: AnyCtx,
  userId: Id<"users">,
  pacienteId: Id<"users">,
): Promise<void> {
  if (userId === pacienteId) return;

  const userMemberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  const clinicasGestion = userMemberships
    .filter((m) => tieneGestion(m.puesto))
    .map((m) => m.clinicId);

  if (clinicasGestion.length === 0) {
    throw new Error(ERR_NO_ACCESO);
  }

  for (const clinicId of clinicasGestion) {
    const pacienteEnClinica = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", pacienteId).eq("clinicId", clinicId),
      )
      .unique();
    if (
      pacienteEnClinica &&
      (pacienteEnClinica.puesto === "paciente" ||
        pacienteEnClinica.tambienEsPaciente === true)
    ) {
      return;
    }
  }

  throw new Error(ERR_NO_ACCESO);
}

/**
 * Lanza si `userId` no puede acceder al plan.
 * Reglas (aislamiento estricto):
 *   - Si el plan tiene `clinicId`, requerir que `userId` sea miembro de esa
 *     clínica. Además: o bien `userId === pacienteId`, o bien `userId` tiene
 *     rol de gestión (fisio/admin) en esa clínica.
 *   - Si el plan NO tiene `clinicId` (plan legado), recae en el filtro de
 *     `assertCanAccessPaciente` sobre el pacienteId del plan.
 */
export async function assertCanAccessPlan(
  ctx: AnyCtx,
  userId: Id<"users">,
  planId: Id<"plans">,
): Promise<Doc<"plans">> {
  const plan = await ctx.db.get(planId);
  if (!plan) throw new Error("Plan no encontrado");

  if (plan.clinicId) {
    if (userId === plan.pacienteId) {
      // El paciente accede a sus propios planes siempre que siga siendo
      // miembro de la clínica del plan.
      await assertCanAccessClinic(ctx, userId, plan.clinicId, [
        "paciente",
        "fisio",
        "admin",
      ]);
      return plan;
    }
    await assertCanAccessClinic(ctx, userId, plan.clinicId, PUESTOS_GESTION);
    return plan;
  }

  // Plan legado sin clinicId — caer al criterio por paciente.
  await assertCanAccessPaciente(ctx, userId, plan.pacienteId);
  return plan;
}

/**
 * Lanza si `userId` no puede GESTIONAR (editar/eliminar/versionar/cambiar
 * estado) el plan. A diferencia de `assertCanAccessPlan`, NO concede acceso al
 * paciente dueño: solo fisio/admin de la clínica del plan.
 *   - Con clinicId: requiere ser fisio/admin de esa clínica.
 *   - Sin clinicId (legado): cae a `assertCanAccessPaciente`, que ya exige rol
 *     de gestión sobre el paciente en alguna clínica común.
 */
export async function assertCanManagePlan(
  ctx: AnyCtx,
  userId: Id<"users">,
  planId: Id<"plans">,
): Promise<Doc<"plans">> {
  const plan = await ctx.db.get(planId);
  if (!plan) throw new Error("Plan no encontrado");

  if (plan.clinicId) {
    await assertCanAccessClinic(ctx, userId, plan.clinicId, PUESTOS_GESTION);
    return plan;
  }

  // Plan legado sin clinicId — caer al criterio por paciente (gestión-only).
  await assertCanAccessPaciente(ctx, userId, plan.pacienteId);
  return plan;
}

/**
 * Lanza si `userId` no puede acceder a la sesión.
 * Reglas:
 *   - El paciente dueño de la sesión accede siempre.
 *   - Cualquier fisio/admin de la clínica de la sesión accede.
 *   - Nadie más.
 */
export async function assertCanAccessSession(
  ctx: AnyCtx,
  userId: Id<"users">,
  sessionId: Id<"sessions">,
): Promise<Doc<"sessions">> {
  const session = await ctx.db.get(sessionId);
  if (!session) throw new Error("Sesión no encontrada");

  if (userId === session.pacienteId) return session;

  await assertCanAccessClinic(ctx, userId, session.clinicId, PUESTOS_GESTION);
  return session;
}

/**
 * Lanza si `userId` no puede acceder a la rutina.
 * Reglas:
 *   - "privado": solo el autor.
 *   - "clinica" con clinicId: cualquier miembro de esa clínica.
 *   - "clinica" sin clinicId (legacy): el autor, o cualquier coworker.
 */
export async function assertCanAccessRoutine(
  ctx: AnyCtx,
  userId: Id<"users">,
  routineId: Id<"routines">,
): Promise<Doc<"routines">> {
  const routine = await ctx.db.get(routineId);
  if (!routine) throw new Error("Rutina no encontrada");

  if (routine.autorId === userId) return routine;

  if (routine.visibilidad === "privado") {
    throw new Error(ERR_NO_ACCESO);
  }

  if (routine.clinicId) {
    await assertCanAccessClinic(ctx, userId, routine.clinicId);
    return routine;
  }

  // Rutina "clinica" sin clinicId (legacy): comprobar coworkers del autor.
  const coworkers = await getCoworkerUserIds(ctx, routine.autorId);
  if (!coworkers.has(userId)) {
    throw new Error(ERR_NO_ACCESO);
  }
  return routine;
}
