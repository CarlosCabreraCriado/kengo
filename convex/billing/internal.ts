import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { LIMITE_FISIOS_AUTOSERVICIO } from "./_helpers";

const estadoLocal = v.union(
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("incomplete"),
  v.literal("unpaid"),
  v.literal("none"),
);

/**
 * Inserta o actualiza el registro `clinicBilling` de la clínica indicada.
 * Se invoca desde webhooks Stripe (sesión 3) y desde acciones internas
 * (sesión 2). `actualizadoEn` se sella siempre con `Date.now()`.
 */
export const upsertClinicBilling = internalMutation({
  args: {
    clinicId: v.id("clinics"),
    estadoLocal: v.optional(estadoLocal),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    trialEnd: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    graceUntil: v.optional(v.number()),
    cantidadFisios: v.optional(v.number()),
    requiereContactoVentas: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { clinicId, ...rest } = args;

    const existing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .unique();

    const patch = {
      ...rest,
      actualizadoEn: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("clinicBilling", {
      clinicId,
      estadoLocal: rest.estadoLocal ?? "none",
      ...rest,
      actualizadoEn: Date.now(),
    });
  },
});

/**
 * Sincroniza la quantity de Stripe con el número real de fisios+admin de la
 * clínica. Llamada desde `clinicMemberships.add/remove` y `accessCodes.consume`
 * mediante `ctx.scheduler.runAfter(0, ...)`.
 *
 * - Si n > LIMITE_FISIOS_AUTOSERVICIO marca `requiereContactoVentas = true` y
 *   no toca Stripe (la mutation que dispara debería haber bloqueado antes con
 *   `REQUIERE_CONTACTO_VENTAS`).
 * - Si la clínica todavía no tiene `stripeSubscriptionId` (la action de trial
 *   aún no terminó), no hace nada: la subscription se creará con la quantity
 *   correcta.
 * - Si la quantity local ya coincide con el cacheado, no encola action.
 */
export const syncQuantityFromMemberships = internalMutation({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .collect();
    const n = memberships.filter(
      (m) => m.puesto === "fisio" || m.puesto === "admin",
    ).length;

    if (n > LIMITE_FISIOS_AUTOSERVICIO) {
      const existing = await ctx.db
        .query("clinicBilling")
        .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          requiereContactoVentas: true,
          actualizadoEn: Date.now(),
        });
      } else {
        await ctx.db.insert("clinicBilling", {
          clinicId,
          estadoLocal: "none",
          requiereContactoVentas: true,
          actualizadoEn: Date.now(),
        });
      }
      return;
    }

    const billing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .unique();

    if (!billing?.stripeSubscriptionId) return;
    if (billing.cantidadFisios === n) return;

    await ctx.scheduler.runAfter(
      0,
      internal.billing.actions.updateStripeQuantity,
      { clinicId, quantity: n },
    );
  },
});

/**
 * Devuelve la información que las actions de Stripe necesitan para crear
 * customer/subscription o leer estado actual: clínica, owner (email/name)
 * y el `clinicBilling` cacheado si existe.
 *
 * **Owner determinista**: lee `clinic.ownerUserId` (Bloque J). El campo
 * es no-opcional en schema, así que siempre hay exactamente un owner; los
 * emails de billing y el customer Stripe siempre se atribuyen al mismo
 * destinatario sin depender del orden interno de Convex.
 */
export const getBillingContext = internalQuery({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    const clinic = await ctx.db.get(clinicId);
    if (!clinic) throw new Error("Clínica no encontrada");

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .collect();

    const cantidadFisios = memberships.filter(
      (m) => m.puesto === "fisio" || m.puesto === "admin",
    ).length;

    let owner: { email: string; name: string } | null = null;
    const ownerUser = await ctx.db.get(clinic.ownerUserId);
    if (ownerUser) {
      owner = {
        email: ownerUser.email,
        name: `${ownerUser.firstName} ${ownerUser.lastName}`.trim(),
      };
    }

    const billing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .unique();

    return {
      clinic: {
        _id: clinic._id,
        nombre: clinic.nombre,
        email: clinic.email,
      },
      owner,
      cantidadFisios,
      billing: billing
        ? {
            stripeCustomerId: billing.stripeCustomerId,
            stripeSubscriptionId: billing.stripeSubscriptionId,
            estadoLocal: billing.estadoLocal,
          }
        : null,
    };
  },
});

/**
 * Mapea el `status` de Stripe (string) al `estadoLocal` que persistimos en
 * `clinicBilling`. Cualquier status no contemplado se cae a `"none"`.
 */
function mapStripeStatusToEstadoLocal(
  status: string,
):
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unpaid"
  | "none" {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "unpaid":
      return status;
    case "incomplete_expired":
      return "canceled";
    default:
      return "none";
  }
}

/**
 * Aplica los cambios de una `customer.subscription.created`/`updated` al
 * `clinicBilling`. Recibe los campos extraídos del evento ya tipados.
 *
 * **Ordering por timestamp**: si la fila `clinicBilling` existente ya fue
 * actualizada con un evento más reciente (`lastStripeEventMs >= eventCreatedMs`),
 * el evento se descarta como "stale". Esto cubre el caso de webhooks que
 * llegan fuera de orden (Stripe no garantiza ordering estricto).
 */
export const applySubscriptionEvent = internalMutation({
  args: {
    clinicId: v.id("clinics"),
    status: v.string(),
    trialEnd: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    quantity: v.optional(v.number()),
    /** Timestamp del evento Stripe (`event.created * 1000`). */
    eventCreatedMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .unique();

    // Ordering: si el evento es más antiguo que el último aplicado, ignorar.
    if (
      existing &&
      args.eventCreatedMs !== undefined &&
      existing.lastStripeEventMs !== undefined &&
      existing.lastStripeEventMs >= args.eventCreatedMs
    ) {
      console.log(
        `[billing] applySubscriptionEvent stale (clinic=${args.clinicId}, eventMs=${args.eventCreatedMs}, lastMs=${existing.lastStripeEventMs}) — ignorado`,
      );
      return existing._id;
    }

    const patch: Record<string, unknown> = {
      estadoLocal: mapStripeStatusToEstadoLocal(args.status),
      cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? false,
      actualizadoEn: Date.now(),
    };
    if (args.trialEnd !== undefined) patch["trialEnd"] = args.trialEnd;
    if (args.currentPeriodEnd !== undefined) {
      patch["currentPeriodEnd"] = args.currentPeriodEnd;
    }
    if (args.quantity !== undefined) patch["cantidadFisios"] = args.quantity;
    if (args.eventCreatedMs !== undefined) {
      patch["lastStripeEventMs"] = args.eventCreatedMs;
    }

    // Si la subscription vuelve a active/trialing tras un past_due, limpiar
    // el periodo de gracia que pudimos haber calculado nosotros.
    const nuevoEstado = patch["estadoLocal"];
    if (nuevoEstado === "active" || nuevoEstado === "trialing") {
      patch["graceUntil"] = undefined;
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("clinicBilling", {
      clinicId: args.clinicId,
      estadoLocal: mapStripeStatusToEstadoLocal(args.status),
      trialEnd: args.trialEnd,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? false,
      cantidadFisios: args.quantity,
      lastStripeEventMs: args.eventCreatedMs,
      actualizadoEn: Date.now(),
    });
  },
});

/**
 * Registra un evento Stripe procesado en `stripeWebhookEvents` para
 * garantizar idempotencia del `onEvent` handler. Devuelve `{ skip: true }`
 * si el `eventId` ya estaba registrado: el caller debe abortar el
 * procesamiento sin re-aplicar efectos colaterales.
 *
 * El componente `@convex-dev/stripe` ya hace upserts idempotentes en sus
 * tablas internas, pero NO protege nuestro código en `onEvent` (emails,
 * mutaciones a clinicBilling, scheduled actions). Esta tabla cubre ese
 * gap.
 */
/**
 * Marca el envío del email de bienvenida tras el primer checkout exitoso.
 * Idempotencia para que reactivaciones (cancel → reactivar) no disparen
 * un segundo welcome.
 */
export const markWelcomeEmailSent = internalMutation({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    const existing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .unique();
    if (!existing) return;
    if (existing.welcomeEmailSentAt) return;
    await ctx.db.patch(existing._id, {
      welcomeEmailSentAt: Date.now(),
      actualizadoEn: Date.now(),
    });
  },
});

/**
 * Reasigna el `stripeSubscriptionId` local de una clínica. Usado tras un
 * Checkout en `mode: 'subscription'` (caso reactivar tras `canceled`) para
 * apuntar a la nueva subscription creada por Stripe, y por el self-heal de
 * `cancelSubscription`/`reactivateSubscription` cuando detecta que la sub
 * local está obsoleta. Idempotente: si el valor coincide, no escribe.
 */
export const upsertStripeSubscriptionId = internalMutation({
  args: {
    clinicId: v.id("clinics"),
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, { clinicId, stripeSubscriptionId }) => {
    const existing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .unique();
    if (!existing) return;
    if (existing.stripeSubscriptionId === stripeSubscriptionId) return;
    await ctx.db.patch(existing._id, {
      stripeSubscriptionId,
      actualizadoEn: Date.now(),
    });
  },
});

export const recordWebhookEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    createdMs: v.number(),
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args): Promise<{ skip: boolean }> => {
    const existing = await ctx.db
      .query("stripeWebhookEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .unique();

    if (existing) {
      return { skip: true };
    }

    await ctx.db.insert("stripeWebhookEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      createdMs: args.createdMs,
      clinicId: args.clinicId,
      processedAt: Date.now(),
    });

    return { skip: false };
  },
});

/**
 * Marca la suscripción como cancelada definitivamente (evento
 * `customer.subscription.deleted`).
 */
export const markCanceled = internalMutation({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    const existing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .unique();
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      estadoLocal: "canceled",
      actualizadoEn: Date.now(),
    });
  },
});

/**
 * Marca la suscripción como `past_due` y calcula `graceUntil = now + N días`,
 * donde N viene de `STRIPE_GRACE_PERIOD_DAYS` (default 7). Encola el email
 * de aviso al admin.
 */
export const markPastDueWithGrace = internalMutation({
  args: {
    clinicId: v.id("clinics"),
    gracePeriodDays: v.number(),
  },
  handler: async (ctx, { clinicId, gracePeriodDays }) => {
    const existing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .unique();
    const graceUntil = Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000;
    if (existing) {
      await ctx.db.patch(existing._id, {
        estadoLocal: "past_due",
        graceUntil,
        actualizadoEn: Date.now(),
      });
    } else {
      await ctx.db.insert("clinicBilling", {
        clinicId,
        estadoLocal: "past_due",
        graceUntil,
        actualizadoEn: Date.now(),
      });
    }
    await ctx.scheduler.runAfter(
      0,
      internal.billing.actions.notifyPaymentFailed,
      { clinicId },
    );
  },
});

/**
 * Marca la suscripción como activa y limpia el periodo de gracia (evento
 * `invoice.paid` cuando estaba `past_due`).
 */
export const markActiveAfterPayment = internalMutation({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    const existing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .unique();
    if (!existing) return;
    if (existing.estadoLocal === "past_due") {
      await ctx.db.patch(existing._id, {
        estadoLocal: "active",
        graceUntil: undefined,
        actualizadoEn: Date.now(),
      });
    }
  },
});

/**
 * Encola el aviso de "tu trial está a punto de terminar" (evento
 * `customer.subscription.trial_will_end`).
 */
export const enqueueTrialEndingNotification = internalMutation({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    await ctx.scheduler.runAfter(
      0,
      internal.billing.actions.notifyTrialEnding,
      { clinicId },
    );
  },
});

/**
 * Cron diario: marca como `unpaid` las clínicas en `past_due` cuyo periodo de
 * gracia ya expiró. A partir de ahí el helper `requireActiveSubscription`
 * bloquea a los fisios/admin.
 */
export const checkGracePeriodsExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const clinics = await ctx.db.query("clinicBilling").collect();
    let count = 0;
    for (const billing of clinics) {
      if (
        billing.estadoLocal === "past_due" &&
        billing.graceUntil !== undefined &&
        billing.graceUntil < now
      ) {
        await ctx.db.patch(billing._id, {
          estadoLocal: "unpaid",
          actualizadoEn: now,
        });
        count++;
      }
    }
    if (count > 0) {
      console.log(`[billing] ${count} clínicas pasaron a unpaid por gracia agotada`);
    }
  },
});

/**
 * Helper de testing/QA: fuerza `graceUntil` de una clínica a un momento
 * arbitrario (admite valores negativos para simular "gracia agotada"). NO usar
 * en producción; existe para validar el flujo del cron `checkGracePeriodsExpired`
 * sin esperar 7 días reales. Solo invocable desde el Convex Dashboard porque es
 * una `internalMutation`.
 */
export const setGraceUntilForTesting = internalMutation({
  args: {
    clinicId: v.id("clinics"),
    daysFromNow: v.number(),
  },
  handler: async (ctx, { clinicId, daysFromNow }) => {
    const billing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .unique();
    if (!billing) {
      throw new Error("clinicBilling no existe para esta clínica");
    }
    const graceUntil = Date.now() + daysFromNow * 24 * 60 * 60 * 1000;
    await ctx.db.patch(billing._id, {
      graceUntil,
      actualizadoEn: Date.now(),
    });
    console.log(
      `[TESTING] graceUntil de ${clinicId} → ${new Date(graceUntil).toISOString()}`,
    );
    return { graceUntil };
  },
});

/**
 * Verifica que el usuario identificado por `externalId` (subject de la auth
 * identity) es admin de la clínica. Lanza error si no lo es. Útil desde
 * actions: `ctx.runQuery(internal.billing.internal.assertAdminOnClinicByExternalId, ...)`.
 *
 * **Nota**: las actions de billing (Checkout, Portal, cancelación...) deben
 * usar `assertOwnerOnClinicByExternalId` en su lugar (Bloque J). Este helper
 * permanece por si alguna mutación de gestión interna lo necesita.
 */
export const assertAdminOnClinicByExternalId = internalQuery({
  args: { externalId: v.string(), clinicId: v.id("clinics") },
  handler: async (ctx, { externalId, clinicId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    if (!user) throw new Error("Usuario no encontrado");

    const membership = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", user._id).eq("clinicId", clinicId),
      )
      .unique();
    if (!membership || membership.puesto !== "admin") {
      throw new Error("No eres administrador de esta clínica");
    }
    return user._id;
  },
});

function assertBillingPermiteOperar(billing: {
  estadoLocal: string;
  graceUntil?: number;
} | null): void {
  if (!billing) return;
  if (billing.estadoLocal === "trialing" || billing.estadoLocal === "active") {
    return;
  }
  if (
    billing.estadoLocal === "past_due" &&
    billing.graceUntil !== undefined &&
    billing.graceUntil > Date.now()
  ) {
    return;
  }
  throw new ConvexError({
    code: "SUBSCRIPTION_INACTIVE",
    message: "La suscripción de la clínica está inactiva.",
  });
}

/**
 * Verifica que la clínica tiene una suscripción en estado operativo (trialing,
 * active, o past_due con gracia vigente). Lanza `ConvexError({ code:
 * "SUBSCRIPTION_INACTIVE" })` si no. Usar desde actions cuando se vaya a
 * iniciar una operación de escritura:
 * `ctx.runQuery(internal.billing.internal.assertActiveSubscription, { clinicId })`.
 */
export const assertActiveSubscription = internalQuery({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    const billing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .unique();
    assertBillingPermiteOperar(billing);
  },
});

/**
 * Verifica que el usuario identificado por `externalId` (fisio/admin) es
 * miembro de **al menos una** clínica con suscripción operativa. Lanza
 * `ConvexError({ code: "SUBSCRIPTION_INACTIVE" })` en caso contrario. Si el
 * usuario no es miembro de ninguna clínica facturable, deja pasar.
 */
export const assertAnyActiveSubscriptionByExternalId = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    if (!user) throw new Error("Usuario no encontrado");

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) => q.eq("userId", user._id))
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
      if (!billing) return;
      if (
        billing.estadoLocal === "trialing" ||
        billing.estadoLocal === "active"
      ) {
        return;
      }
      if (
        billing.estadoLocal === "past_due" &&
        billing.graceUntil !== undefined &&
        billing.graceUntil > Date.now()
      ) {
        return;
      }
    }

    throw new ConvexError({
      code: "SUBSCRIPTION_INACTIVE",
      message:
        "Ninguna de tus clínicas tiene una suscripción activa. Actualiza el método de pago para seguir trabajando.",
    });
  },
});

/**
 * Variante de `assertActiveSubscription` que resuelve el `clinicId` a partir
 * de un `planId`. Usar desde actions que parten de un plan (envío de PDF,
 * magic link asociado a un plan).
 */
export const assertActiveSubscriptionByPlanId = internalQuery({
  args: { planId: v.id("plans") },
  handler: async (ctx, { planId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("Plan no encontrado");
    const billing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", plan.clinicId))
      .unique();
    assertBillingPermiteOperar(billing);
  },
});

/**
 * Verifica que el usuario identificado por `externalId` es el **propietario**
 * (`clinics.ownerUserId`) de la clínica. Lanza `ConvexError({ code:
 * "OWNER_REQUIRED" })` si no lo es. Usar desde actions de billing:
 * `ctx.runQuery(internal.billing.internal.assertOwnerOnClinicByExternalId, ...)`.
 *
 * Devuelve el `userId` para que el caller pueda continuar sin volver a buscarlo.
 */
export const assertOwnerOnClinicByExternalId = internalQuery({
  args: { externalId: v.string(), clinicId: v.id("clinics") },
  handler: async (ctx, { externalId, clinicId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    if (!user) throw new Error("Usuario no encontrado");

    const clinic = await ctx.db.get(clinicId);
    if (!clinic) throw new Error("Clínica no encontrada");

    if (clinic.ownerUserId !== user._id) {
      throw new ConvexError({
        code: "OWNER_REQUIRED",
        message: "Solo el propietario de la clínica puede realizar esta acción.",
      });
    }
    return user._id;
  },
});
