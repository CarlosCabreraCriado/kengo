import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export type Puesto = "fisio" | "paciente" | "admin";

export const PUESTOS_GESTION: readonly Puesto[] = ["fisio", "admin"] as const;

export const esFisio = (puesto: Puesto) => puesto === "fisio";
export const esPaciente = (puesto: Puesto) => puesto === "paciente";
export const esAdmin = (puesto: Puesto) => puesto === "admin";
export const tieneGestion = (puesto: Puesto) =>
  puesto === "fisio" || puesto === "admin";

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
 * Devuelve `true` si `userId` es el propietario (owner) de la clínica.
 * El owner es el único usuario que puede gestionar la suscripción Stripe.
 * Si la clínica todavía no tiene `ownerUserId` (caso transitorio durante la
 * migración del Bloque J), devuelve `false`.
 */
export async function esOwner(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
  userId: Id<"users">,
): Promise<boolean> {
  const clinic = await ctx.db.get(clinicId);
  if (!clinic) return false;
  return clinic.ownerUserId === userId;
}

/**
 * Lanza `ConvexError({ code: "OWNER_REQUIRED" })` si `userId` no es el
 * propietario de la clínica. Usar en mutations/actions de billing que solo
 * el owner puede ejecutar.
 */
export async function assertOwnerOnClinic(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
  userId: Id<"users">,
): Promise<void> {
  if (!(await esOwner(ctx, clinicId, userId))) {
    throw new ConvexError({
      code: "OWNER_REQUIRED",
      message: "Solo el propietario de la clínica puede realizar esta acción.",
    });
  }
}

/**
 * Variante para actions: resuelve `userId` desde el `externalId` (subject
 * de la auth identity) y luego valida que es owner. Paralela a
 * `assertAdminOnClinicByExternalId` en `convex/billing/internal.ts`.
 *
 * Devuelve el `userId` del owner para que el caller pueda continuar sin
 * volver a buscarlo.
 */
export async function assertOwnerOnClinicByExternalId(
  ctx: QueryCtx | MutationCtx,
  externalId: string,
  clinicId: Id<"clinics">,
): Promise<Id<"users">> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
    .unique();
  if (!user) throw new Error("Usuario no encontrado");
  await assertOwnerOnClinic(ctx, clinicId, user._id);
  return user._id;
}

/**
 * Valida la invariante "el owner siempre es admin de la clínica". Usar en
 * `transferOwnership` antes de aplicar el patch.
 */
export async function assertOwnerIsAdmin(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
  candidateUserId: Id<"users">,
): Promise<void> {
  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId_clinicId", (q) =>
      q.eq("userId", candidateUserId).eq("clinicId", clinicId),
    )
    .unique();
  if (!membership || membership.puesto !== "admin") {
    throw new ConvexError({
      code: "OWNER_MUST_BE_ADMIN",
      message:
        "El nuevo propietario debe ser administrador de la clínica. Promociónalo a administrador antes de transferir la propiedad.",
    });
  }
}

/**
 * Lanza `ConvexError({ code: "OWNER_MUST_TRANSFER_FIRST" })` si el usuario
 * que pretende abandonar la clínica (`userIdSaliente`) es el propietario.
 * Validación independiente del estado de billing: el owner debe transferir
 * SIEMPRE antes de salir, incluso si la suscripción está cancelada, porque
 * la clínica podría reactivarse y necesita un responsable.
 */
export async function assertNotOwnerWithoutTransfer(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
  userIdSaliente: Id<"users">,
): Promise<void> {
  if (await esOwner(ctx, clinicId, userIdSaliente)) {
    throw new ConvexError({
      code: "OWNER_MUST_TRANSFER_FIRST",
      message:
        "Eres el propietario de la clínica. Transfiere la propiedad a otro administrador antes de salir.",
    });
  }
}

/**
 * Verifica que el usuario tiene un puesto específico en una clínica.
 */
export async function checkClinicPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
  puestosPermitidos: readonly Puesto[],
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

/**
 * Devuelve `true` si el `clinicBilling` está en un estado que permite operar.
 * Estados aceptados:
 *   - `trialing`, `active`
 *   - `past_due` con `graceUntil` aún en el futuro
 * Se trata `!billing` como permisivo: clínica recién creada (race con la
 * action de trial start) o clínica pre-Stripe que aún no tiene registro.
 */
export function billingPermiteOperar(billing: {
  estadoLocal: string;
  graceUntil?: number;
} | null): boolean {
  if (!billing) return true;
  if (billing.estadoLocal === "trialing" || billing.estadoLocal === "active") {
    return true;
  }
  // Enterprise (>10 fisios) pendiente de acuerdo con ventas: opera con
  // normalidad mientras se cierra el contrato — no bloqueamos (B-9).
  if (billing.estadoLocal === "enterprise_pending") {
    return true;
  }
  if (
    billing.estadoLocal === "past_due" &&
    billing.graceUntil !== undefined &&
    billing.graceUntil > Date.now()
  ) {
    return true;
  }
  return false;
}

/**
 * Lanza `ConvexError({ code: "SUBSCRIPTION_INACTIVE" })` si la suscripción de
 * la clínica está suspendida (`unpaid`/`canceled`/`past_due` con gracia
 * agotada). Usar en mutations que requieren clínica activa.
 */
export async function requireActiveSubscription(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
) {
  const billing = await ctx.db
    .query("clinicBilling")
    .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
    .unique();

  if (!billingPermiteOperar(billing)) {
    throw new ConvexError({
      code: "SUBSCRIPTION_INACTIVE",
      message: "La suscripción de la clínica está inactiva.",
    });
  }
}

/**
 * Variante para mutations sin `clinicId` explícito (planes, rutinas): permite
 * operar si AL MENOS UNA clínica del usuario donde es fisio/admin tiene
 * suscripción activa. Si no es miembro de ninguna clínica, deja pasar (caso
 * marginal — usuarios huérfanos no llegan aquí porque el contenido necesita
 * fisio/admin para crearse).
 */
export async function requireAnyActiveSubscriptionForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const memberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId_clinicId", (q) => q.eq("userId", userId))
    .collect();

  const facturables = memberships.filter(
    (m) => m.puesto === "fisio" || m.puesto === "admin",
  );
  if (facturables.length === 0) return;

  for (const m of facturables) {
    const billing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", m.clinicId))
      .unique();
    if (billingPermiteOperar(billing)) return;
  }

  throw new ConvexError({
    code: "SUBSCRIPTION_INACTIVE",
    message:
      "Ninguna de tus clínicas tiene una suscripción activa. Actualiza el método de pago para seguir trabajando.",
  });
}
