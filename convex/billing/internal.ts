import { v } from "convex/values";
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
 * customer/subscription o leer estado actual: clínica, owner admin (email/name)
 * y el `clinicBilling` cacheado si existe.
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

    const adminMembership = memberships.find((m) => m.puesto === "admin");
    let owner: { email: string; name: string } | null = null;
    if (adminMembership) {
      const ownerUser = await ctx.db.get(adminMembership.userId);
      if (ownerUser) {
        owner = {
          email: ownerUser.email,
          name: `${ownerUser.firstName} ${ownerUser.lastName}`.trim(),
        };
      }
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
 */
export const applySubscriptionEvent = internalMutation({
  args: {
    clinicId: v.id("clinics"),
    status: v.string(),
    trialEnd: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .unique();

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
      actualizadoEn: Date.now(),
    });
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
