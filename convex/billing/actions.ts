"use node";

import { v } from "convex/values";
import Stripe from "stripe";
import { StripeSubscriptions } from "@convex-dev/stripe";
import { internal, components } from "../_generated/api";
import { internalAction, action } from "../_generated/server";

const stripeApi = new StripeSubscriptions(components.stripe);

function getStripeClient(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY no configurada");
  return new Stripe(key);
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no configurada`);
  return value;
}

/**
 * Devuelve `KENGO_APP_URL` normalizada al origin (sin path ni slash final).
 * Lanza con mensaje accionable si la variable falta o no es una URL absoluta
 * http(s); Stripe rechaza cualquier `success_url`/`cancel_url` que no parsee.
 */
function getAppUrl(): string {
  const value = process.env["KENGO_APP_URL"];
  if (!value) throw new Error("KENGO_APP_URL no configurada");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `KENGO_APP_URL inválida: "${value}" — debe ser una URL absoluta http(s)://, sin comas ni espacios`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `KENGO_APP_URL inválida: "${value}" — protocolo "${parsed.protocol}" no soportado, usa http(s)://`,
    );
  }
  return parsed.origin;
}

const APP_URL_FALLBACK = "https://kengoapp.com";

/**
 * Variante tolerante: si la variable es inválida cae al fallback en vez de
 * abortar, para no perder envíos de email por una mala configuración. Loguea
 * un warning para que la mala config siga siendo visible en los runs.
 */
function getAppUrlOrFallback(): string {
  try {
    return getAppUrl();
  } catch (err) {
    console.warn(
      `[billing] KENGO_APP_URL inválida o ausente, usando fallback ${APP_URL_FALLBACK}: ${(err as Error).message}`,
    );
    return APP_URL_FALLBACK;
  }
}

async function requireExternalId(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("No autenticado");
  return identity.subject;
}

/**
 * Crea customer en Stripe + suscripción con trial sin tarjeta. Idempotente:
 * si la clínica ya tiene `stripeSubscriptionId`, no recrea.
 *
 * Llamada por `clinics.create` vía `ctx.scheduler.runAfter(0, ...)`.
 */
export const startTrialForClinic = internalAction({
  args: {
    clinicId: v.id("clinics"),
    /** Override del default `STRIPE_TRIAL_DAYS=14`. Útil para migraciones. */
    trialDays: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { clinicId, trialDays },
  ): Promise<
    | { ok: true; alreadyExists: true }
    | { ok: true; trialEnd: number | undefined }
  > => {
    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );

    if (data.billing?.stripeSubscriptionId) {
      return { ok: true, alreadyExists: true } as const;
    }

    const days = trialDays ?? Number(process.env["STRIPE_TRIAL_DAYS"] ?? 14);
    const priceId = getEnv("STRIPE_PRICE_ID");
    const stripe = getStripeClient();

    let customerId = data.billing?.stripeCustomerId;
    if (!customerId) {
      const created = await stripeApi.createCustomer(ctx, {
        email: data.owner?.email ?? data.clinic.email,
        name: data.owner?.name ?? data.clinic.nombre,
        metadata: { orgId: clinicId },
        idempotencyKey: clinicId,
      });
      customerId = created.customerId;
    }

    const quantity = Math.max(1, data.cantidadFisios);
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId, quantity }],
      trial_period_days: days,
      metadata: { orgId: clinicId },
      // Si al final del trial no hay método de pago, dejamos que Stripe cree la
      // factura y marque la subscription como past_due. El wall de pago se
      // activará vía webhook + helper requireActiveSubscription (sesión 3).
      trial_settings: {
        end_behavior: { missing_payment_method: "create_invoice" },
      },
      // Stripe Tax: calcula IVA automáticamente al emitir facturas. Si el
      // admin no completó Checkout (donde se recoge NIF/CIF + address), la
      // primera factura post-trial saldrá sin tax — el correo
      // `trial_will_end` debe insistir en completar datos antes del final
      // del trial.
      automatic_tax: { enabled: true },
    });

    const trialEnd = subscription.trial_end
      ? subscription.trial_end * 1000
      : undefined;
    // En Stripe SDK 22 `current_period_end` vive en cada subscription item.
    const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
    const currentPeriodEnd = itemPeriodEnd ? itemPeriodEnd * 1000 : undefined;

    await ctx.runMutation(internal.billing.internal.upsertClinicBilling, {
      clinicId,
      estadoLocal: "trialing",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      trialEnd,
      currentPeriodEnd,
      cantidadFisios: quantity,
    });

    return { ok: true, trialEnd } as const;
  },
});

/**
 * Extiende (o inicia) el trial de una clínica concreta. Reutilizable como
 * herramienta de soporte; invocable desde el Convex Dashboard.
 *
 * - Sin `stripeSubscriptionId`: delega en `startTrialForClinic` con
 *   `trialDays = dias`. Crea customer + subscription Stripe y persiste
 *   `clinicBilling`.
 * - Con `stripeSubscriptionId`: actualiza `trial_end` en Stripe; el webhook
 *   `customer.subscription.updated` propaga el cambio a `clinicBilling`. Como
 *   cinturón de seguridad por si el webhook tarda, también hace upsert local.
 */
export const extendTrialForClinic = internalAction({
  args: {
    clinicId: v.id("clinics"),
    dias: v.number(),
  },
  handler: async (
    ctx,
    { clinicId, dias },
  ): Promise<
    | { caso: "iniciado"; alreadyExists: true }
    | { caso: "iniciado"; trialEnd: number | undefined }
    | { caso: "extendido"; trialEnd: number }
  > => {
    if (dias < 1 || dias > 365) {
      throw new Error("dias debe estar entre 1 y 365");
    }

    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );

    if (!data.billing?.stripeSubscriptionId) {
      const result = await ctx.runAction(
        internal.billing.actions.startTrialForClinic,
        { clinicId, trialDays: dias },
      );
      return { caso: "iniciado", ...result } as const;
    }

    const trialEndMs = Date.now() + dias * 24 * 60 * 60 * 1000;
    const trialEndSec = Math.floor(trialEndMs / 1000);

    const stripe = getStripeClient();
    await stripe.subscriptions.update(data.billing.stripeSubscriptionId, {
      trial_end: trialEndSec,
      proration_behavior: "none",
    });

    await ctx.runMutation(internal.billing.internal.upsertClinicBilling, {
      clinicId,
      estadoLocal: "trialing",
      trialEnd: trialEndMs,
    });

    return { caso: "extendido", trialEnd: trialEndMs } as const;
  },
});

/**
 * Crea una sesión de Stripe Checkout para que el admin añada método de pago
 * y active la suscripción tras el trial. Devuelve `{ url }`.
 */
export const createCheckoutSession = action({
  args: {
    clinicId: v.id("clinics"),
    /**
     * Plataforma desde la que se llama. En `native` Stripe redirige al
     * interstitial estático `/billing-return.html` que dispara el deep link
     * `kengo://billing/return?status=...` para devolver el control a la app.
     */
    returnTo: v.optional(v.union(v.literal("native"), v.literal("web"))),
  },
  handler: async (
    ctx,
    { clinicId, returnTo = "web" },
  ): Promise<{ url: string }> => {
    const externalId = await requireExternalId(ctx);
    await ctx.runQuery(
      internal.billing.internal.assertOwnerOnClinicByExternalId,
      { externalId, clinicId },
    );

    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );

    let customerId = data.billing?.stripeCustomerId;
    if (!customerId) {
      const created = await stripeApi.createCustomer(ctx, {
        email: data.owner?.email ?? data.clinic.email,
        name: data.owner?.name ?? data.clinic.nombre,
        metadata: { orgId: clinicId },
        idempotencyKey: clinicId,
      });
      customerId = created.customerId;
    }

    const appUrl = getAppUrl();
    const isNative = returnTo === "native";
    const successUrl = isNative
      ? `${appUrl}/billing-return.html?status=success`
      : `${appUrl}/mi-clinica/suscripcion?ok=1`;
    const cancelUrl = isNative
      ? `${appUrl}/billing-return.html?status=cancel`
      : `${appUrl}/mi-clinica/suscripcion?cancel=1`;

    // Llamada directa a Stripe (no usamos `stripeApi.createCheckoutSession`)
    // para poder configurar Stripe Tax + recogida obligatoria de NIF/CIF +
    // forzar el cobro de un método de pago nuevo en reactivaciones.
    // El componente `@convex-dev/stripe` no expone estos campos.
    //
    // Cumplimiento fiscal España (B2B):
    //   - `automatic_tax`: Stripe calcula el IVA según jurisdicción.
    //   - `tax_id_collection.required: 'if_supported'`: pide NIF/CIF al
    //     comprador. Stripe lo guarda en el customer y lo incluye en la
    //     factura.
    //   - `customer_update`: tras Checkout, Stripe actualiza
    //     name/address/tax_id en el customer existente. Sin esto, los
    //     datos quedarían sueltos en la session.
    //   - `payment_method_collection: 'always'`: tras una cancelación,
    //     evita que Stripe reutilice un método caducado al reactivar.
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: getEnv("STRIPE_PRICE_ID"),
          quantity: Math.max(1, data.cantidadFisios),
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_collection: "always",
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true, required: "if_supported" },
      customer_update: { name: "auto", address: "auto" },
      metadata: { orgId: clinicId },
      subscription_data: {
        metadata: { orgId: clinicId },
      },
    });

    if (!session.url) throw new Error("Stripe no devolvió URL de checkout");
    return { url: session.url };
  },
});

/**
 * Crea una sesión del Customer Portal de Stripe para gestionar método de pago,
 * cancelar, descargar facturas, etc. Devuelve `{ url }`.
 */
export const createCustomerPortalSession = action({
  args: {
    clinicId: v.id("clinics"),
    returnTo: v.optional(v.union(v.literal("native"), v.literal("web"))),
  },
  handler: async (
    ctx,
    { clinicId, returnTo = "web" },
  ): Promise<{ url: string }> => {
    const externalId = await requireExternalId(ctx);
    await ctx.runQuery(
      internal.billing.internal.assertOwnerOnClinicByExternalId,
      { externalId, clinicId },
    );

    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    const customerId = data.billing?.stripeCustomerId;
    if (!customerId) {
      throw new Error("La clínica aún no tiene customer en Stripe");
    }

    const appUrl = getAppUrl();
    const returnUrl =
      returnTo === "native"
        ? `${appUrl}/billing-return.html?status=portal`
        : `${appUrl}/mi-clinica/suscripcion`;

    const session = await stripeApi.createCustomerPortalSession(ctx, {
      customerId,
      returnUrl,
    });
    return { url: session.url };
  },
});

/**
 * Cancela la suscripción al final del periodo (por defecto) o inmediatamente.
 */
export const cancelSubscription = action({
  args: {
    clinicId: v.id("clinics"),
    atPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { clinicId, atPeriodEnd = true },
  ): Promise<{ ok: true }> => {
    const externalId = await requireExternalId(ctx);
    await ctx.runQuery(
      internal.billing.internal.assertOwnerOnClinicByExternalId,
      { externalId, clinicId },
    );

    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    const subId = data.billing?.stripeSubscriptionId;
    if (!subId) throw new Error("La clínica no tiene suscripción");

    await stripeApi.cancelSubscription(ctx, {
      stripeSubscriptionId: subId,
      cancelAtPeriodEnd: atPeriodEnd,
    });

    await ctx.runMutation(internal.billing.internal.upsertClinicBilling, {
      clinicId,
      cancelAtPeriodEnd: atPeriodEnd,
    });

    return { ok: true } as const;
  },
});

/**
 * Reactiva una suscripción que estaba marcada para cancelarse al final del
 * periodo.
 */
export const reactivateSubscription = action({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }): Promise<{ ok: true }> => {
    const externalId = await requireExternalId(ctx);
    await ctx.runQuery(
      internal.billing.internal.assertOwnerOnClinicByExternalId,
      { externalId, clinicId },
    );

    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    const subId = data.billing?.stripeSubscriptionId;
    if (!subId) throw new Error("La clínica no tiene suscripción");

    await stripeApi.reactivateSubscription(ctx, {
      stripeSubscriptionId: subId,
    });

    await ctx.runMutation(internal.billing.internal.upsertClinicBilling, {
      clinicId,
      cancelAtPeriodEnd: false,
    });

    return { ok: true } as const;
  },
});

function diasHasta(timestampMs: number | undefined): number {
  if (!timestampMs) return 0;
  const ms = timestampMs - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Notifica al admin de la clínica que su trial está a punto de terminar.
 * Se invoca desde `handleStripeEvent` al recibir `customer.subscription.trial_will_end`.
 */
export const notifyTrialEnding = internalAction({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }): Promise<void> => {
    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    if (!data.owner) return;

    const billing = await ctx.runQuery(
      internal.billing.queries.getClinicBillingStatusInternal,
      { clinicId },
    );
    const diasRestantes = diasHasta(billing?.trialEnd);

    const appUrl = getAppUrlOrFallback();
    await ctx.runAction(internal.email.actions.sendTrialEndingEmail, {
      to: data.owner.email,
      nombreAdmin: data.owner.name,
      clinicaNombre: data.clinic.nombre,
      diasRestantes,
      portalUrl: `${appUrl}/mi-clinica/suscripcion`,
    });
  },
});

/**
 * Notifica al admin de la clínica que el pago de la última factura ha fallado.
 * Se invoca desde `handleStripeEvent` al recibir `invoice.payment_failed`.
 */
export const notifyPaymentFailed = internalAction({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }): Promise<void> => {
    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    if (!data.owner) return;

    const appUrl = getAppUrlOrFallback();
    await ctx.runAction(internal.email.actions.sendPaymentFailedEmail, {
      to: data.owner.email,
      nombreAdmin: data.owner.name,
      clinicaNombre: data.clinic.nombre,
      portalUrl: `${appUrl}/mi-clinica/suscripcion`,
    });
  },
});

/**
 * Envía un email de bienvenida al propietario tras completar el primer
 * checkout exitoso (`checkout.session.completed`). Idempotente vía
 * `clinicBilling.welcomeEmailSentAt`: si una clínica reactiva tras una
 * cancelación previa, no se reenvía la bienvenida.
 */
export const notifyCheckoutCompleted = internalAction({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }): Promise<void> => {
    const billing = await ctx.runQuery(
      internal.billing.queries.getClinicBillingStatusInternal,
      { clinicId },
    );
    if (billing?.welcomeEmailSentAt) return; // ya enviado, ignorar.

    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    if (!data.owner) return;

    const appUrl = getAppUrlOrFallback();
    await ctx.runAction(internal.email.actions.sendWelcomeAfterCheckoutEmail, {
      to: data.owner.email,
      nombreAdmin: data.owner.name,
      clinicaNombre: data.clinic.nombre,
      portalUrl: `${appUrl}/mi-clinica/suscripcion`,
    });

    await ctx.runMutation(internal.billing.internal.markWelcomeEmailSent, {
      clinicId,
    });
  },
});

/**
 * Envía un email de confirmación cuando la suscripción se cancela
 * definitivamente (`customer.subscription.deleted`). No tiene flag de
 * idempotencia porque, si hay reentrega del webhook, el dedup global
 * (`stripeWebhookEvents`) lo cubre.
 */
export const notifySubscriptionCanceled = internalAction({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }): Promise<void> => {
    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    if (!data.owner) return;

    const appUrl = getAppUrlOrFallback();
    await ctx.runAction(internal.email.actions.sendSubscriptionCanceledEmail, {
      to: data.owner.email,
      nombreAdmin: data.owner.name,
      clinicaNombre: data.clinic.nombre,
      reactivateUrl: `${appUrl}/mi-clinica/suscripcion`,
    });
  },
});

/**
 * Solicitud del admin de una clínica para contactar con ventas (caso +10
 * fisioterapeutas, fuera del autoservicio). Envía un email al equipo de
 * contacto vía Resend con los datos de la clínica y del solicitante.
 */
export const contactarVentas = action({
  args: {
    clinicId: v.id("clinics"),
    mensaje: v.string(),
    telefono: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { clinicId, mensaje, telefono },
  ): Promise<{ ok: true }> => {
    const externalId = await requireExternalId(ctx);
    await ctx.runQuery(
      internal.billing.internal.assertOwnerOnClinicByExternalId,
      { externalId, clinicId },
    );

    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );

    const adminEmail = data.owner?.email ?? data.clinic.email;
    const adminNombre = data.owner?.name ?? "Administrador";
    if (!adminEmail) {
      throw new Error("La clínica no tiene email de contacto");
    }

    const cuerpo = [
      `Solicitud de plan enterprise (+10 fisioterapeutas)`,
      ``,
      `Clínica: ${data.clinic.nombre}`,
      `Clinic ID: ${clinicId}`,
      `Fisios actuales: ${data.cantidadFisios}`,
      `Solicitante: ${adminNombre} <${adminEmail}>`,
      telefono ? `Teléfono: ${telefono}` : null,
      ``,
      `Mensaje:`,
      mensaje,
    ]
      .filter((l) => l !== null)
      .join("\n");

    await ctx.runAction(internal.email.actions.sendContactForm, {
      nombre: adminNombre,
      email: adminEmail,
      asunto: `[Kengo] +10 fisios — ${data.clinic.nombre}`,
      mensaje: cuerpo,
    });

    return { ok: true } as const;
  },
});

/**
 * Lista las últimas facturas de la clínica directamente desde Stripe (no via
 * componente, porque queremos `hosted_invoice_url` e `invoice_pdf` para
 * descarga). Devuelve hasta `limit` facturas (default 6) ordenadas por fecha
 * descendente. Si la clínica aún no tiene customer en Stripe, devuelve lista
 * vacía sin error.
 */
export const listInvoicesForClinic = action({
  args: {
    clinicId: v.id("clinics"),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { clinicId, limit = 6 },
  ): Promise<{
    invoices: Array<{
      id: string;
      numero: string | null;
      creadoEn: number;
      importeTotal: number;
      moneda: string;
      estado: "paid" | "open" | "uncollectible" | "void" | "draft";
      pdfUrl: string | null;
      hostedUrl: string | null;
    }>;
    error?: string;
  }> => {
    const externalId = await requireExternalId(ctx);
    await ctx.runQuery(
      internal.billing.internal.assertOwnerOnClinicByExternalId,
      { externalId, clinicId },
    );

    const billing = await ctx.runQuery(
      internal.billing.queries.getClinicBillingStatusInternal,
      { clinicId },
    );
    const customerId = billing?.stripeCustomerId;
    if (!customerId) {
      return { invoices: [] };
    }

    try {
      const stripe = getStripeClient();
      const result = await stripe.invoices.list({
        customer: customerId,
        limit: Math.min(Math.max(1, limit), 24),
      });

      const invoices = result.data.map((inv) => ({
        id: inv.id ?? "",
        numero: inv.number ?? null,
        creadoEn: (inv.created ?? 0) * 1000,
        importeTotal: inv.total ?? 0,
        moneda: inv.currency ?? "eur",
        estado: (inv.status ?? "draft") as
          | "paid"
          | "open"
          | "uncollectible"
          | "void"
          | "draft",
        pdfUrl: inv.invoice_pdf ?? null,
        hostedUrl: inv.hosted_invoice_url ?? null,
      }));

      return { invoices };
    } catch (err) {
      console.error("[listInvoicesForClinic]", err);
      return {
        invoices: [],
        error: "No se pudieron cargar las facturas",
      };
    }
  },
});

/**
 * Internal: actualiza la quantity de Stripe con prorrateo automático.
 * La encola `syncQuantityFromMemberships` cuando detecta cambios.
 */
export const updateStripeQuantity = internalAction({
  args: { clinicId: v.id("clinics"), quantity: v.number() },
  handler: async (ctx, { clinicId, quantity }): Promise<void> => {
    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    const subId = data.billing?.stripeSubscriptionId;
    if (!subId) return;

    await stripeApi.updateSubscriptionQuantity(ctx, {
      stripeSubscriptionId: subId,
      quantity,
    });

    await ctx.runMutation(internal.billing.internal.upsertClinicBilling, {
      clinicId,
      cantidadFisios: quantity,
    });
  },
});
