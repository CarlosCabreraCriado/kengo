"use node";

import { v, ConvexError } from "convex/values";
import Stripe from "stripe";
import { StripeSubscriptions } from "@convex-dev/stripe";
import { internal, components } from "../_generated/api";
import { internalAction, action, type ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  planParaFisios,
  excedeCapBase,
  LIMITE_FISIOS_AUTOSERVICIO,
  buildCustomerOwnerPatch,
  ownerEnFecha,
  resumenTarjeta,
  idDeRef,
  type PlanVariante,
} from "./_helpers";
import type { MetodoDePagoAportado } from "./paymentMethods";
import { esPriceAMedida } from "./_webhookHelpers";
import {
  resolveRegimenFiscal,
  buildCustomerRegimenPatch,
  buildSubscriptionRegimenPatch,
  subscriptionTaxRatesFor,
  esSubscriptionActualizable,
  type RegimenFiscal,
} from "./_taxHelpers";

const stripeApi = new StripeSubscriptions(components.stripe);

/**
 * Sincroniza el `invoice_settings.custom_fields` del customer con la etiqueta
 * de tramo según el número de fisios. Stripe muestra estos campos en la
 * cabecera de la factura, aclarando al cliente qué plan está pagando — esto
 * es importante porque nuestro Price tiered usa `quantity = N fisios`, lo
 * que en factura se muestra como `"Producto × N"` y puede confundir.
 *
 * Con un contrato a medida (`esAMedida`) la etiqueta es "Plan a medida": los
 * tramos de autoservicio no describen lo que paga esa clínica.
 *
 * Si `cantidadFisios` está fuera de los tramos autoservicio (0 o >9),
 * limpiamos el field para no exponer un texto desactualizado o incorrecto.
 */
async function syncStripeCustomerTierLabel(
  stripe: Stripe,
  customerId: string,
  cantidadFisios: number,
  variante: PlanVariante,
  esAMedida = false,
): Promise<void> {
  const tier = esAMedida ? null : planParaFisios(cantidadFisios);
  const custom_fields = esAMedida
    ? [{ name: "Plan", value: "Plan a medida" }]
    : tier
    ? [
        {
          name: "Plan",
          value:
            variante === "ilimitada"
              ? `Plan ${tier.nombre} Ilimitado`
              : `Plan ${tier.nombre}`,
        },
      ]
    : [];
  try {
    await stripe.customers.update(customerId, {
      invoice_settings: { custom_fields },
    });
  } catch (err) {
    // No bloqueante: si la sincronización falla, la factura saldrá sin la
    // etiqueta pero el importe seguirá siendo correcto. Lo logueamos para
    // que sea visible.
    console.warn(
      `[billing] syncStripeCustomerTierLabel falló para customer=${customerId}: ${(err as Error).message}`,
    );
  }
}

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

/** Price de Stripe para la variante de pricing de la clínica. */
function getPriceIdForVariante(variante: PlanVariante | undefined): string {
  if (variante === "ilimitada") return getEnv("STRIPE_PRICE_ID_ILIMITADO");
  return getEnv("STRIPE_PRICE_ID_BASE");
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

/**
 * Contexto mínimo de clínica/owner que necesitan los dos caminos que crean
 * customer. Es el subconjunto de `getBillingContext` que consumen.
 */
type ClinicCustomerData = {
  clinic: { nombre: string; email?: string };
  owner: { email: string; name: string } | null;
};

/**
 * Devuelve el `stripeCustomerId` de la clínica, creando uno solo si de verdad
 * no existe ninguno.
 *
 * Antes de crear busca en Stripe por `metadata.orgId`. Parece redundante con la
 * idempotency key `create_customer_<clinicId>` del componente, pero cubre justo
 * el hueco que esa key deja: **caduca a las 24 h**, y el cron
 * `billing-reconcile-trials` corre exactamente cada 24 h. Si una ejecución
 * anterior murió entre crear el customer y persistir `clinicBilling` — en medio
 * van `syncCustomerDefaults` y `subscriptions.create` — el customer quedó
 * huérfano en Stripe y sin fila local, y sin esta búsqueda el cron crearía uno
 * nuevo cada día indefinidamente, sin ninguna señal. Las dos protecciones se
 * complementan: la key cubre el reintento inmediato (el índice de búsqueda de
 * Stripe tarda hasta ~1 min en refrescar) y la búsqueda cubre el resto.
 *
 * Con más de un customer para el mismo `orgId` **aborta**. Ese estado no
 * debería existir, y elegir uno por nuestra cuenta arriesga facturar contra el
 * que no es: mejor que salte y se consolide a mano.
 *
 * Ojo: al reutilizar no se escribe la tabla `customers` del componente
 * `@convex-dev/stripe` (solo la toca su propio `createCustomer`). No importa
 * porque no la leemos en ningún sitio — el webhook resuelve la clínica por
 * `metadata.orgId`, nunca por esa tabla.
 */
async function getOrCreateCustomerForClinic(
  ctx: ActionCtx,
  stripe: Stripe,
  clinicId: Id<"clinics">,
  data: ClinicCustomerData,
): Promise<string> {
  const encontrados = await stripe.customers
    .search({ query: `metadata['orgId']:'${clinicId}'`, limit: 2 })
    .catch((err: unknown) => {
      // La búsqueda es una red de seguridad, no el camino feliz: si el índice
      // de Stripe no responde seguimos adelante apoyados en la idempotency
      // key, que cubre el caso frecuente.
      console.warn(
        `[billing] búsqueda de customer por orgId falló para clinic=${clinicId}: ${(err as Error).message}`,
      );
      return null;
    });

  if (encontrados && encontrados.data.length > 1) {
    const ids = encontrados.data.map((c) => c.id).join(", ");
    console.error(
      `[billing] clinic=${clinicId} tiene ${encontrados.data.length} customers en Stripe (${ids}) — hay que consolidarlos a mano`,
    );
    throw new Error(
      `Clínica ${clinicId} con customers duplicados en Stripe: ${ids}`,
    );
  }

  const huerfano = encontrados?.data[0];
  if (huerfano) {
    console.log(
      `[billing] reutilizado customer ${huerfano.id} para clinic=${clinicId} (existía en Stripe sin fila clinicBilling)`,
    );
    return huerfano.id;
  }

  const created = await stripeApi.createCustomer(ctx, {
    email: data.owner?.email ?? data.clinic.email,
    name: data.owner?.name ?? data.clinic.nombre,
    metadata: { orgId: clinicId },
    idempotencyKey: clinicId,
  });
  return created.customerId;
}

/**
 * Fija en el customer la `description` (nombre de la clínica), que el
 * componente no permite pasar en la creación. `name` y `email` son los del
 * owner, así que un fisio con varias clínicas genera un customer por clínica
 * todos con el mismo nombre y correo, indistinguibles en el Dashboard salvo
 * abriendo cada uno a mirar el `metadata`. `description` es la columna que
 * Stripe enseña en la lista de Customers y, a diferencia de `name`, Checkout
 * no la sobrescribe (`customer_update: { name: "auto" }`).
 *
 * No se rellena ningún `address` por defecto: la dirección fiscal la recoge
 * Checkout y sobre ella decide `resolveRegimenFiscal`. Un país inventado
 * convertiría un régimen `desconocido` en `inversion` sin que el cliente
 * haya dicho dónde está.
 *
 * Un solo `retrieve` y, como mucho, un `update`; idempotente.
 */
async function syncCustomerDefaults(
  stripe: Stripe,
  customerId: string,
  nombreClinica: string,
): Promise<void> {
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer) return;
  if (customer.description === nombreClinica) return;

  await stripe.customers.update(customerId, { description: nombreClinica });
}

// ─── Régimen fiscal (IGIC / inversión del sujeto pasivo) ───
//
// Kengo factura desde Canarias. Stripe Tax no calcula impuesto para clientes
// canarios y cobraría IVA a los peninsulares, así que el impuesto se aplica a
// mano: Tax Rate IGIC en la suscripción de los clientes canarios y
// `tax_exempt: "reverse"` (inversión del sujeto pasivo) en el resto. La lógica
// de decisión es pura (`_taxHelpers.ts`); aquí solo se lee y escribe Stripe.

/** Tax Rate manual "IGIC 7 %" creado en el Dashboard (test y live). */
function getIgicTaxRateId(): string {
  return getEnv("STRIPE_TAX_RATE_ID_IGIC");
}

interface RegimenAplicado {
  regimen: RegimenFiscal;
  address: Stripe.Address | null;
}

/**
 * Qué debe hacer `finalizeCheckout` al completarse una sesión de Checkout
 * (siempre `mode: 'setup'`). Viaja en `metadata.action` de la sesión y del
 * SetupIntent.
 */
type CheckoutAction = "attach_pm_end_trial" | "create_subscription";

/**
 * Lee la dirección fiscal del customer, resuelve el régimen y alinea
 * `tax_exempt` y el pie de factura. Idempotente: si el customer ya está como
 * debe, no escribe (así el `customer.updated` que dispara nuestro propio
 * update no provoca otro update).
 */
async function syncCustomerRegimen(
  stripe: Stripe,
  customerId: string,
): Promise<RegimenAplicado> {
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer) {
    throw new Error(`Customer ${customerId} borrado en Stripe`);
  }
  const regimen = resolveRegimenFiscal(customer.address);
  const patch = buildCustomerRegimenPatch(customer, regimen);
  if (patch) {
    await stripe.customers.update(customerId, patch);
  }
  return { regimen, address: customer.address ?? null };
}

/**
 * Alinea `default_tax_rates` de una suscripción viva con el régimen y apaga
 * `automatic_tax` si seguía activo de la etapa Stripe Tax. Devuelve `true`
 * si escribió. Las subs `canceled`/`incomplete_expired` son inmutables y se
 * ignoran.
 */
async function syncSubscriptionRegimen(
  stripe: Stripe,
  sub: Stripe.Subscription,
  regimen: RegimenFiscal,
): Promise<boolean> {
  if (!esSubscriptionActualizable(sub.status)) return false;
  const patch = buildSubscriptionRegimenPatch(sub, regimen, getIgicTaxRateId());
  if (!patch) return false;
  await stripe.subscriptions.update(sub.id, patch);
  return true;
}

/** Espeja el régimen en `clinicBilling` para la UI. */
async function persistRegimen(
  ctx: ActionCtx,
  clinicId: Id<"clinics">,
  { regimen, address }: RegimenAplicado,
): Promise<void> {
  await ctx.runMutation(internal.billing.internal.setRegimenFiscal, {
    clinicId,
    regimenFiscal: regimen,
    paisFiscal: address?.country ?? undefined,
    codigoPostalFiscal: address?.postal_code ?? undefined,
  });
}

/**
 * Forma tipada de `getCustomerOwnerSyncContext`. Anotada a mano porque las
 * actions que llaman a queries del mismo `api` necesitan tipos explícitos
 * para no entrar en inferencia circular.
 */
type CustomerOwnerSyncContext = {
  stripeCustomerId: string | null;
  owner: { email: string; name: string } | null;
  ownerAnteriorNombre: string | undefined;
};

type CustomerOwnerPatch = { email?: string; name?: string };

/**
 * Lee el customer y calcula el patch de owner. `null` cuando no hay nada que
 * cambiar; lanza si el customer no existe o está borrado en Stripe.
 */
async function resolveCustomerOwnerPatch(
  stripe: Stripe,
  customerId: string,
  data: CustomerOwnerSyncContext,
): Promise<CustomerOwnerPatch | null> {
  if (!data.owner) throw new Error("la clínica no tiene owner resoluble");
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer) throw new Error("customer borrado en Stripe");
  return buildCustomerOwnerPatch(customer, data.owner, data.ownerAnteriorNombre);
}

/**
 * Alinea `email`/`name` del customer de Stripe con el propietario actual de la
 * clínica. La programan con `runAfter(0)` todas las vías que reescriben
 * `clinics.ownerUserId` (`transferOwnership`, `forceTransferOwnership`, la
 * fusión de cuentas y el borrado con reemplazo). Sin ella, facturas y avisos
 * de impago seguirían llegando al owner saliente.
 *
 * Fire-and-forget: nunca lanza. La propiedad ya cambió en Convex y un fallo
 * aquí no debe aparecerle al usuario; queda en logs y lo recoge el backfill
 * `backfillCustomerOwners`.
 */
export const syncCustomerOwner = internalAction({
  args: {
    clinicId: v.id("clinics"),
    ownerAnteriorNombre: v.optional(v.string()),
  },
  handler: async (ctx, { clinicId, ownerAnteriorNombre }): Promise<void> => {
    try {
      const data: CustomerOwnerSyncContext = await ctx.runQuery(
        internal.billing.internal.getCustomerOwnerSyncContext,
        { clinicId, ownerAnteriorNombre },
      );
      const customerId = data.stripeCustomerId;
      if (!customerId || !data.owner) {
        console.warn(
          `[billing] syncCustomerOwner clinic=${clinicId} sin customer u owner; nada que sincronizar.`,
        );
        return;
      }

      const stripe = getStripeClient();
      const patch = await resolveCustomerOwnerPatch(stripe, customerId, data);
      if (!patch) return;

      await stripe.customers.update(customerId, patch);
      console.log(
        `[billing] syncCustomerOwner clinic=${clinicId} customer=${customerId}: ${Object.keys(patch).join(", ")} actualizado(s)`,
      );
    } catch (err) {
      console.warn(
        `[billing] syncCustomerOwner falló para clinic=${clinicId}: ${(err as Error).message}`,
      );
    }
  },
});

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
 * Self-heal del `stripeSubscriptionId` local. Si la sub apuntada en
 * `clinicBilling` está `canceled` o `incomplete_expired` (caso típico de
 * clínicas creadas antes del fix de `finalizeSubscriptionCheckout`, cuando
 * Checkout `mode: 'subscription'` creaba una S2 nueva pero el ID se quedaba
 * apuntando a la S1 huérfana), busca la sub viva más reciente del customer y
 * la persiste localmente. Devuelve el subId resuelto que el caller debe usar.
 *
 * Si no existe ninguna sub viva, devuelve el `localSubId` original para que
 * el caller pueda decidir lanzar un error semántico ("sin suscripción").
 */
async function resolveActiveSubscriptionId(
  ctx: ActionCtx,
  stripe: Stripe,
  clinicId: Id<"clinics">,
  localSubId: string,
  customerId: string,
): Promise<string> {
  const sub = await stripe.subscriptions
    .retrieve(localSubId)
    .catch(() => null);

  const isDead =
    !sub ||
    sub.status === "canceled" ||
    sub.status === "incomplete_expired";
  if (!isDead) return localSubId;

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });
  const alive = subs.data
    .filter(
      (s) =>
        s.status !== "canceled" && s.status !== "incomplete_expired",
    )
    .sort((a, b) => b.created - a.created)[0];
  if (!alive) return localSubId;

  await ctx.runMutation(
    internal.billing.internal.upsertStripeSubscriptionId,
    { clinicId, stripeSubscriptionId: alive.id },
  );
  console.log(
    `[billing] resolveActiveSubscriptionId clinic=${clinicId} local=${localSubId} → resolved=${alive.id}`,
  );
  return alive.id;
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
    const variante: PlanVariante = data.billing?.variante ?? "base";
    const priceId = getPriceIdForVariante(variante);
    const stripe = getStripeClient();

    const customerId =
      data.billing?.stripeCustomerId ??
      (await getOrCreateCustomerForClinic(ctx, stripe, clinicId, data));
    await syncCustomerDefaults(stripe, customerId, data.clinic.nombre);

    const quantity = Math.max(1, data.cantidadFisios);
    await syncStripeCustomerTierLabel(stripe, customerId, quantity, variante);
    const subscription = await stripe.subscriptions.create(
      {
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
        // Sin impuesto todavía: la dirección fiscal se conoce al completar
        // Checkout y es ahí (`finalizeCheckout`) donde se fija el IGIC o la
        // inversión del sujeto pasivo, en la misma llamada que emite la
        // primera factura. Nunca `automatic_tax` (ver `_taxHelpers.ts`).
      },
      // M-2: clave de idempotencia por clínica. Si la action se reintenta tras
      // crear la sub pero antes de persistirla (timeout/fallo parcial), Stripe
      // devuelve la MISMA sub en vez de crear una segunda sub de trial. Ojo:
      // reutilizar la clave con un body distinto dentro de las 24 h de
      // ventana da un 400 de Stripe; se autocorrige cuando la clave caduca.
      { idempotencyKey: `trial-sub-${clinicId}` },
    );

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
      variante,
    });
    // Explícito para que la UI muestre "Pendiente de dirección fiscal" en vez
    // de un hueco.
    await ctx.runMutation(internal.billing.internal.setRegimenFiscal, {
      clinicId,
      regimenFiscal: "desconocido",
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

    const stripe = getStripeClient();

    // El puntero local puede apuntar a una sub muerta (`canceled` /
    // `incomplete_expired`). Si la hay, `resolveActiveSubscriptionId` cura el
    // puntero hacia la sub viva más reciente del customer; si no hay ninguna
    // viva, devuelve el subId original (que seguirá muerto).
    const customerId = data.billing.stripeCustomerId;
    const resolvedSubId = customerId
      ? await resolveActiveSubscriptionId(
          ctx,
          stripe,
          clinicId,
          data.billing.stripeSubscriptionId,
          customerId,
        )
      : data.billing.stripeSubscriptionId;

    const resolvedSub = await stripe.subscriptions
      .retrieve(resolvedSubId)
      .catch(() => null);
    const subMuerta =
      !resolvedSub ||
      resolvedSub.status === "canceled" ||
      resolvedSub.status === "incomplete_expired";

    // Sin ninguna sub viva: Stripe no permite revivir una `canceled`. Limpiamos
    // el puntero local para desbloquear la idempotencia de `startTrialForClinic`
    // y creamos una sub nueva con trial reutilizando el customer existente.
    if (subMuerta) {
      await ctx.runMutation(
        internal.billing.internal.clearStripeSubscriptionId,
        { clinicId },
      );
      const result = await ctx.runAction(
        internal.billing.actions.startTrialForClinic,
        { clinicId, trialDays: dias },
      );
      return { caso: "iniciado", ...result } as const;
    }

    const trialEndMs = Date.now() + dias * 24 * 60 * 60 * 1000;
    const trialEndSec = Math.floor(trialEndMs / 1000);

    await stripe.subscriptions.update(resolvedSubId, {
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
    /**
     * Variante elegida en la UI pre-checkout (none/canceled/incomplete). Solo
     * aplica en `mode: 'subscription'`; en `mode: 'setup'` (trialing) se
     * ignora — la sub S1 ya existe y su variante se cambia con
     * `setPlanVariante`. Se persiste en `clinicBilling` antes de crear la
     * sesión para que el webhook (`resolveVarianteFromPriceId`) y la etiqueta
     * del customer queden coherentes con el price elegido.
     */
    variante: v.optional(v.union(v.literal("base"), v.literal("ilimitada"))),
  },
  handler: async (
    ctx,
    { clinicId, returnTo = "web", variante: varianteArg },
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

    const estado = data.billing?.estadoLocal ?? "none";
    const esTrial = estado === "trialing";
    const checkoutAction: CheckoutAction = esTrial
      ? "attach_pm_end_trial"
      : "create_subscription";
    const esAMedida = data.billing?.limiteFisios !== undefined;

    // Contrato a medida: solo se bloquea la rama que crearía una S2 con un
    // price de autoservicio (borraría el price negociado que ventas configuró
    // en el Dashboard). En trial el Checkout es `mode: 'setup'` y se limita a
    // adjuntar la tarjeta a la sub existente sin tocar su price, así que el
    // owner sí puede añadirla desde aquí. La UI oculta el CTA en el otro caso,
    // pero el gate tiene que estar también en servidor.
    if (esAMedida && checkoutAction === "create_subscription") {
      throw new ConvexError({
        code: "SUSCRIPCION_A_MEDIDA",
        message:
          "Tu clínica tiene un contrato a medida. Contacta con nosotros para cambiarlo.",
      });
    }

    const stripe = getStripeClient();
    const customerId =
      data.billing?.stripeCustomerId ??
      (await getOrCreateCustomerForClinic(ctx, stripe, clinicId, data));
    await syncCustomerDefaults(stripe, customerId, data.clinic.nombre);

    const appUrl = getAppUrl();
    const isNative = returnTo === "native";
    const successUrl = isNative
      ? `${appUrl}/billing-return.html?status=success`
      : `${appUrl}/mi-clinica/suscripcion?ok=1`;
    const cancelUrl = isNative
      ? `${appUrl}/billing-return.html?status=cancel`
      : `${appUrl}/mi-clinica/suscripcion?cancel=1`;

    // Todo Checkout es `mode: 'setup'`: recoge tarjeta, dirección fiscal y
    // NIF sin cobrar nada. El cobro lo hace después `finalizeCheckout` (webhook
    // `checkout.session.completed`), que ya conoce la dirección y puede fijar
    // el impuesto correcto (IGIC vs inversión del sujeto pasivo) en la misma
    // llamada que emite la primera factura. Un `mode: 'subscription'`
    // cobraría dentro del propio Checkout, antes de saber el código postal.
    //
    // La `action` de la sesión le dice al finalize qué hacer:
    //   - `attach_pm_end_trial` (trialing): la S1 ya existe; adjuntar el PM y
    //     terminar el trial con `trial_end: 'now'`. Una única sub durante
    //     toda la vida.
    //   - `create_subscription` (canceled | none | incomplete | trial
    //     vencido): Stripe no permite revivir una sub `canceled`; el finalize
    //     crea la S2 en servidor con el PM y los tax rates.
    //
    // Cumplimiento fiscal España (B2B):
    //   - `tax_id_collection.required: 'if_supported'`: pide NIF/CIF al
    //     comprador (para España resulta obligatorio). Stripe lo guarda en el
    //     customer y lo incluye en la factura.
    //   - `billing_address_collection: 'required'`: dirección fiscal
    //     completa (calle/CP/ciudad). Sobre su CP decide `resolveRegimenFiscal`.
    //   - `customer_update`: tras Checkout, Stripe actualiza
    //     name/address/tax_id en el customer existente.

    // Variante efectiva de la sesión. Durante el trial el arg se ignora: la
    // S1 ya existe con su price y cambiarlo aquí puentearía el flujo
    // `setPlanVariante` (proration). No lanzamos para no convertir en error
    // una carrera benigna de UI (el estado cambió entre render y click).
    const variantePersistida: PlanVariante = data.billing?.variante ?? "base";
    const varianteEfectiva: PlanVariante = esTrial
      ? variantePersistida
      : (varianteArg ?? variantePersistida);
    if (esTrial && varianteArg && varianteArg !== variantePersistida) {
      console.warn(
        `[billing] createCheckoutSession: variante '${varianteArg}' ignorada durante el trial (clinic=${clinicId})`,
      );
    }

    // Mismo guard que `setPlanVariante`: no se puede contratar la variante
    // base con más pacientes vinculados que su cap.
    if (!esTrial && varianteEfectiva === "base") {
      const { excede, limite } = excedeCapBase(
        Math.max(1, data.cantidadFisios),
        data.cantidadPacientes,
      );
      if (excede) {
        throw new ConvexError({
          code: "PACIENTES_EXCEDEN_LIMITE",
          message: `No puedes contratar el plan base: tienes ${data.cantidadPacientes} pacientes y el límite es ${limite}.`,
          limite,
          pacientesActuales: data.cantidadPacientes,
        });
      }
    }

    // Persistir la variante elegida antes de crear la sesión: el webhook
    // `checkout.session.completed` y `resolveVarianteFromPriceId` la
    // reconfirmarán desde el priceId. Si el usuario abandona el Checkout la
    // variante queda cambiada — aceptable en pre-checkout (la UI se
    // inicializa desde ella).
    if (!esTrial && varianteArg && varianteArg !== variantePersistida) {
      await ctx.runMutation(internal.billing.internal.upsertClinicBilling, {
        clinicId,
        variante: varianteArg,
      });
    }

    // Sincroniza la etiqueta del tramo en el customer antes de abrir Checkout
    // para que aparezca en la factura siguiente. En un contrato a medida la
    // etiqueta es fija ("Plan a medida"): no reescribirla con el tramo.
    await syncStripeCustomerTierLabel(
      stripe,
      customerId,
      esAMedida
        ? (data.billing?.limiteFisios ?? 0)
        : Math.max(1, data.cantidadFisios),
      varianteEfectiva,
      esAMedida,
    );

    // H-2: al reactivar (none / canceled / incomplete) no abrimos Checkout si
    // el customer ya tiene una sub viva en Stripe (debe gestionarse desde el
    // Portal). Solo la comprobación: la limpieza de residuales
    // `past_due`/`unpaid`/`incomplete` la hace `finalizeCheckout` justo antes
    // de crear la S2, para no destruir nada si el usuario abandona el Checkout.
    if (checkoutAction === "create_subscription") {
      const existentes = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      if (
        existentes.data.some(
          (s) => s.status === "active" || s.status === "trialing",
        )
      ) {
        throw new ConvexError({
          code: "SUBSCRIPTION_ALREADY_ACTIVE",
          message:
            "Ya existe una suscripción activa para esta clínica. Gestiónala desde el portal de pago.",
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      payment_method_types: ["card"],
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true, required: "if_supported" },
      customer_update: { name: "auto", address: "auto" },
      setup_intent_data: {
        metadata: {
          orgId: clinicId,
          action: checkoutAction,
          variante: varianteEfectiva,
        },
      },
      // `action` también en la sesión: el finalize la lee sin expandir el
      // SetupIntent.
      metadata: { orgId: clinicId, action: checkoutAction },
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
    const localSubId = data.billing?.stripeSubscriptionId;
    const customerId = data.billing?.stripeCustomerId;
    if (!localSubId || !customerId) {
      throw new Error("La clínica no tiene suscripción");
    }
    const subId = await resolveActiveSubscriptionId(
      ctx,
      getStripeClient(),
      clinicId,
      localSubId,
      customerId,
    );

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
 * Cancela **de inmediato** la suscripción de una clínica que se está cerrando
 * como parte del borrado de cuenta de su propietario.
 *
 * Se diferencia de `cancelSubscription` en tres cosas, y las tres importan:
 *
 *  1. Es interna: la autorización ya la hizo el flujo de borrado, que trabaja
 *     con la identidad de la sesión.
 *  2. Cancela ya, no al final del periodo: la clínica deja de existir, no hay
 *     nadie a quien seguir dando servicio hasta que venza.
 *  3. **Borra antes `orgId` del metadata** de la suscripción. El webhook de
 *     `convex/http.ts` resuelve la clínica por ese campo al recibir
 *     `customer.subscription.updated/deleted`; si lo dejáramos puesto, el
 *     evento de cancelación llegaría mientras la cascada está purgando y
 *     reescribiría `clinicBilling` de una clínica medio borrada. Es el mismo
 *     orden que documenta `docs/CUENTAS_REVISION_TIENDAS.md` §5.
 *
 * Si Stripe falla, propaga el error: es preferible que el usuario reintente el
 * borrado a purgar la clínica dejando viva una suscripción que sigue cobrando.
 */
export const cancelSubscriptionForClinicClosure = internalAction({
  args: { clinicId: v.id("clinics") },
  handler: async (
    ctx,
    { clinicId },
  ): Promise<{ ok: true; canceled: boolean }> => {
    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    const localSubId = data.billing?.stripeSubscriptionId;
    const customerId = data.billing?.stripeCustomerId;

    if (!localSubId || !customerId) {
      // Clínica sin suscripción (nunca la tuvo, o ya se canceló y se
      // desvinculó a mano). No hay nada que cancelar.
      return { ok: true, canceled: false } as const;
    }

    const stripe = getStripeClient();
    const subId = await resolveActiveSubscriptionId(
      ctx,
      stripe,
      clinicId,
      localSubId,
      customerId,
    );

    // `resolveActiveSubscriptionId` devuelve el id local cuando no encuentra
    // ninguna suscripción viva, así que hay que comprobar el estado: Stripe
    // rechaza tanto el update como el cancel sobre una ya cancelada, y eso
    // dejaría al usuario sin poder borrar su cuenta. Es el caso normal de una
    // clínica cuya suscripción se canceló hace tiempo.
    const sub = await stripe.subscriptions.retrieve(subId).catch(() => null);
    if (!sub || sub.status === "canceled" || sub.status === "incomplete_expired") {
      return { ok: true, canceled: false } as const;
    }

    // Stripe borra una clave de metadata cuando se envía con valor vacío.
    await stripe.subscriptions.update(subId, { metadata: { orgId: "" } });
    await stripe.subscriptions.cancel(subId);

    console.log(
      `[billing] cancelSubscriptionForClinicClosure clinic=${clinicId} sub=${subId} cancelada por borrado de cuenta`,
    );

    return { ok: true, canceled: true } as const;
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
    const localSubId = data.billing?.stripeSubscriptionId;
    const customerId = data.billing?.stripeCustomerId;
    if (!localSubId || !customerId) {
      throw new Error("La clínica no tiene suscripción");
    }
    const subId = await resolveActiveSubscriptionId(
      ctx,
      getStripeClient(),
      clinicId,
      localSubId,
      customerId,
    );

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

/**
 * Cambia la variante de pricing de la clínica ("base" ↔ "ilimitada").
 * Owner-only. Hace swap del price del subscription item en Stripe con
 * prorrateo (upgrade a mitad de ciclo factura el delta; en trial es no-op).
 *
 * Guard de downgrade: no se puede volver a "base" si los pacientes vinculados
 * superan el cap del plan actual — lanza `PACIENTES_EXCEDEN_LIMITE`.
 */
export const setPlanVariante = action({
  args: {
    clinicId: v.id("clinics"),
    variante: v.union(v.literal("base"), v.literal("ilimitada")),
  },
  handler: async (ctx, { clinicId, variante }): Promise<{ ok: true }> => {
    const externalId = await requireExternalId(ctx);
    await ctx.runQuery(
      internal.billing.internal.assertOwnerOnClinicByExternalId,
      { externalId, clinicId },
    );

    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    // Contrato a medida: el swap de price sustituiría el price negociado por
    // uno de autoservicio. La variante base/ilimitada no aplica aquí.
    if (data.billing?.limiteFisios !== undefined) {
      throw new ConvexError({
        code: "SUSCRIPCION_A_MEDIDA",
        message:
          "Tu clínica tiene un contrato a medida. Contacta con nosotros para cambiarlo.",
      });
    }

    const varianteActual: PlanVariante = data.billing?.variante ?? "base";
    if (varianteActual === variante) return { ok: true } as const;

    if (variante === "base") {
      const { excede, limite } = excedeCapBase(
        Math.max(1, data.cantidadFisios),
        data.cantidadPacientes,
      );
      if (excede) {
        throw new ConvexError({
          code: "PACIENTES_EXCEDEN_LIMITE",
          message: `No puedes volver al plan base: tienes ${data.cantidadPacientes} pacientes y el límite es ${limite}.`,
          limite,
          pacientesActuales: data.cantidadPacientes,
        });
      }
    }

    const localSubId = data.billing?.stripeSubscriptionId;
    const customerId = data.billing?.stripeCustomerId;
    // Solo hay una sub que actualizar en Stripe si el estado local implica
    // una sub viva. En `canceled`/`incomplete` el `stripeSubscriptionId`
    // local puede apuntar a una sub muerta que Stripe rechazaría actualizar.
    const estadoLocal = data.billing?.estadoLocal ?? "none";
    const estadoConSubViva = !["none", "canceled", "incomplete"].includes(
      estadoLocal,
    );

    // Sin subscription viva en Stripe (enterprise_pending / none / canceled):
    // persistimos solo localmente; el próximo trial/checkout usará el price
    // de esta variante.
    if (localSubId && customerId && estadoConSubViva) {
      const stripe = getStripeClient();
      const subId = await resolveActiveSubscriptionId(
        ctx,
        stripe,
        clinicId,
        localSubId,
        customerId,
      );
      const sub = await stripe.subscriptions.retrieve(subId);
      const item = sub.items.data[0];
      if (!item) throw new Error("La suscripción no tiene items");
      await stripe.subscriptions.update(subId, {
        items: [
          {
            id: item.id,
            price: getPriceIdForVariante(variante),
            quantity: item.quantity ?? Math.max(1, data.cantidadFisios),
          },
        ],
        // Upgrade/downgrade a mitad de ciclo: prorratear el delta. En trial no
        // hay factura, así que es un no-op hasta el primer cobro.
        proration_behavior: "create_prorations",
      });
      await syncStripeCustomerTierLabel(
        stripe,
        customerId,
        Math.max(1, data.cantidadFisios),
        variante,
      );
    }

    await ctx.runMutation(internal.billing.internal.upsertClinicBilling, {
      clinicId,
      variante,
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
 * Deduce la `action` de una sesión de Checkout completada. Prioriza la
 * metadata que grabó `createCheckoutSession`; si falta (sesión antigua),
 * cae al estado local: con S1 en trial se adjunta el PM, si no se crea una
 * S2. Si la action pide adjuntar pero no hay sub local, también se crea.
 */
function resolveCheckoutAction(
  session: Stripe.Checkout.Session,
  setupIntent: Stripe.SetupIntent,
  billing: { estadoLocal: string; stripeSubscriptionId?: string } | null,
): CheckoutAction {
  const declarada =
    session.metadata?.["action"] ?? setupIntent.metadata?.["action"];
  const puedeAdjuntar =
    billing?.estadoLocal === "trialing" && !!billing.stripeSubscriptionId;
  if (declarada === "attach_pm_end_trial") {
    return puedeAdjuntar || billing?.stripeSubscriptionId
      ? "attach_pm_end_trial"
      : "create_subscription";
  }
  if (declarada === "create_subscription") return "create_subscription";
  return puedeAdjuntar ? "attach_pm_end_trial" : "create_subscription";
}

/**
 * Anula la última factura abierta de una sub residual antes de cancelarla:
 * si el trial venció sin tarjeta (`missing_payment_method: create_invoice`)
 * esa factura salió sin régimen fiscal y no debe seguir en dunning una vez
 * que la S2 cobra correctamente. Best-effort: nunca lanza.
 */
async function anularYCancelarSubResidual(
  stripe: Stripe,
  sub: Stripe.Subscription,
  clinicId: Id<"clinics">,
): Promise<void> {
  const invoiceId = idDeRef(sub.latest_invoice);
  if (invoiceId) {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      if (invoice.status === "open") {
        await stripe.invoices.voidInvoice(invoiceId);
      }
    } catch (err) {
      console.warn(
        `[billing] finalizeCheckout: no se pudo anular la invoice ${invoiceId} de la sub residual ${sub.id} (clinic=${clinicId}): ${(err as Error).message}`,
      );
    }
  }
  try {
    await stripe.subscriptions.cancel(sub.id);
  } catch (err) {
    console.error(
      `[billing] finalizeCheckout: no se pudo cancelar la sub residual ${sub.id} (clinic=${clinicId})`,
      err,
    );
  }
}

/**
 * Llamada desde el webhook `checkout.session.completed`. Todo Checkout es
 * `mode: 'setup'`: recoge tarjeta, dirección fiscal y NIF sin cobrar nada.
 * Aquí, ya con la dirección en el customer, se decide el régimen fiscal
 * (IGIC vs inversión del sujeto pasivo) y se emite la primera factura con el
 * impuesto correcto:
 *
 *   - `attach_pm_end_trial`: adjunta el PM a la S1, fija `default_tax_rates`
 *     y termina el trial con `trial_end: 'now'` en una sola llamada → Stripe
 *     cobra y la sub pasa a `active` vía webhooks
 *     (`customer.subscription.updated`, `invoice.paid`). Si el trial venció
 *     mientras el usuario estaba en Checkout (S1 en `past_due`), se paga la
 *     factura pendiente con la tarjeta nueva.
 *   - `create_subscription` (canceled | none | incomplete | trial vencido):
 *     anula y cancela residuales, crea la S2 en servidor con el PM y los tax
 *     rates y persiste su id en `clinicBilling`. Si el banco exige reto SCA
 *     la S2 queda `incomplete` (estado ya soportado por UI y webhooks) y
 *     caduca sola; el usuario repite Checkout.
 *
 * Idempotente frente a reentregas del webhook: PM y régimen se comparan
 * antes de escribir, el `trial_end: 'now'` solo se envía si la S1 sigue en
 * trial y la S2 lleva `idempotencyKey` por sesión además de detectarse por
 * `metadata.checkoutSessionId`.
 */
export const finalizeCheckout = internalAction({
  args: {
    clinicId: v.id("clinics"),
    sessionId: v.string(),
  },
  handler: async (ctx, { clinicId, sessionId }): Promise<void> => {
    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    const customerId = data.billing?.stripeCustomerId;
    if (!customerId) {
      console.warn(
        `[billing] finalizeCheckout sin customerId local clinic=${clinicId}; abortando.`,
      );
      return;
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== "setup") {
      console.warn(
        `[billing] finalizeCheckout session=${sessionId} con mode=${session.mode}; solo se procesan sesiones 'setup'.`,
      );
      return;
    }
    const setupIntentId = idDeRef(session.setup_intent);
    if (!setupIntentId) {
      console.warn(
        `[billing] finalizeCheckout session=${sessionId} sin setup_intent; abortando.`,
      );
      return;
    }

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    const pmId = idDeRef(setupIntent.payment_method);
    if (!pmId) {
      console.warn(
        `[billing] finalizeCheckout setupIntent=${setupIntentId} sin payment_method; abortando.`,
      );
      return;
    }
    const action = resolveCheckoutAction(session, setupIntent, data.billing);

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pmId },
    });
    // Titularidad: registrar el PM (el `payment_method.attached` llegará y
    // será idempotente) y espejar el default sin esperar al webhook.
    const pmObj = await stripe.paymentMethods.retrieve(pmId);
    await ctx.runMutation(internal.billing.paymentMethods.upsertFromStripe, {
      clinicId,
      stripeCustomerId: customerId,
      stripePaymentMethodId: pmId,
      ...resumenTarjeta(pmObj),
      attachedAtMs: pmObj.created * 1000,
      origen: "webhook",
    });
    await ctx.runMutation(
      internal.billing.paymentMethods.setDefaultPaymentMethods,
      { clinicId, subscriptionDefault: pmId, customerDefault: pmId },
    );

    // Régimen fiscal: SIEMPRE antes de emitir factura alguna. Checkout exige
    // la dirección, así que `desconocido` aquí es una anomalía que hay que ver.
    const aplicado = await syncCustomerRegimen(stripe, customerId);
    if (aplicado.regimen === "desconocido") {
      console.warn(
        `[billing] finalizeCheckout: customer=${customerId} sin dirección fiscal tras Checkout (clinic=${clinicId}); la factura saldrá sin régimen.`,
      );
    }
    const taxRates = subscriptionTaxRatesFor(
      aplicado.regimen,
      getIgicTaxRateId(),
    );
    const defaultTaxRates: Stripe.Emptyable<string[]> =
      taxRates.length > 0 ? taxRates : "";

    const subIdLocal = data.billing?.stripeSubscriptionId;
    if (action === "attach_pm_end_trial" && subIdLocal) {
      const sub = await stripe.subscriptions.retrieve(subIdLocal);
      if (sub.status === "past_due" || sub.status === "unpaid") {
        // El trial venció entre abrir y completar el Checkout:
        // `end_behavior: create_invoice` dejó una factura abierta. Poner
        // `trial_end` no la cobra; hay que pagarla con el método nuevo. Esa
        // factura ya está finalizada, así que sale con el régimen que tuviera
        // (normalmente ninguno); las siguientes ya llevan el correcto.
        await stripe.subscriptions.update(subIdLocal, {
          default_payment_method: pmId,
          default_tax_rates: defaultTaxRates,
          automatic_tax: { enabled: false },
        });
        const latestInvoiceId = idDeRef(sub.latest_invoice);
        if (latestInvoiceId) {
          try {
            await stripe.invoices.pay(latestInvoiceId, {
              payment_method: pmId,
            });
          } catch (err) {
            console.error(
              `[billing] finalizeCheckout: error pagando invoice ${latestInvoiceId} clinic=${clinicId}`,
              err,
            );
          }
        }
      } else if (sub.status === "trialing") {
        if (data.billing?.limiteFisios !== undefined) {
          // Contrato a medida: el trial lo pactó ventas y forma parte del
          // contrato. Solo se adjunta la tarjeta y se fija el régimen; el
          // primer cobro sale en la fecha de `trial_end` que hay en Stripe.
          await stripe.subscriptions.update(subIdLocal, {
            default_payment_method: pmId,
            default_tax_rates: defaultTaxRates,
            automatic_tax: { enabled: false },
          });
        } else {
          // Una sola llamada: el régimen viaja con la request que genera la
          // primera factura. Stripe acepta el literal "now" (SDK 20 lo tipa
          // como `'now' | number`); un timestamp `Date.now()` puede llegar ya
          // en el pasado por latencia y ser rechazado.
          await stripe.subscriptions.update(subIdLocal, {
            default_payment_method: pmId,
            trial_end: "now",
            proration_behavior: "none",
            default_tax_rates: defaultTaxRates,
            automatic_tax: { enabled: false },
          });
        }
      } else if (esSubscriptionActualizable(sub.status)) {
        // Reentrega del webhook con la S1 ya `active`: no volver a tocar el
        // trial, solo asegurar PM y régimen.
        await stripe.subscriptions.update(subIdLocal, {
          default_payment_method: pmId,
          default_tax_rates: defaultTaxRates,
          automatic_tax: { enabled: false },
        });
      } else {
        console.warn(
          `[billing] finalizeCheckout: la S1 ${subIdLocal} está ${sub.status} y no admite cambios (clinic=${clinicId}).`,
        );
      }
    } else {
      // create_subscription
      const existentes = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      const yaCreada = existentes.data.find(
        (s) => s.metadata?.["checkoutSessionId"] === sessionId,
      );
      const viva = existentes.data.find(
        (s) => s.status === "active" || s.status === "trialing",
      );
      if (yaCreada) {
        // Reentrega: la S2 de esta sesión ya existe. Solo asegurar el puntero.
        await ctx.runMutation(
          internal.billing.internal.upsertStripeSubscriptionId,
          { clinicId, stripeSubscriptionId: yaCreada.id },
        );
      } else if (viva) {
        // H-2 defensivo: alguien activó otra sub entre abrir y completar el
        // Checkout. No crear una segunda; los webhooks de la viva mandan.
        console.warn(
          `[billing] finalizeCheckout: el customer ${customerId} ya tiene la sub ${viva.id} ${viva.status}; no se crea S2 (clinic=${clinicId}).`,
        );
      } else {
        for (const s of existentes.data) {
          if (
            s.status === "past_due" ||
            s.status === "unpaid" ||
            s.status === "incomplete"
          ) {
            await anularYCancelarSubResidual(stripe, s, clinicId);
          }
        }

        const variante: PlanVariante = data.billing?.variante ?? "base";
        const quantity = Math.max(1, data.cantidadFisios);
        const sub = await stripe.subscriptions.create(
          {
            customer: customerId,
            items: [{ price: getPriceIdForVariante(variante), quantity }],
            default_payment_method: pmId,
            default_tax_rates: taxRates.length > 0 ? taxRates : undefined,
            metadata: { orgId: clinicId, checkoutSessionId: sessionId },
            // La tarjeta se guardó en Checkout para uso off-session; si el
            // banco exige reto igualmente, la sub queda `incomplete` y
            // caduca sola en vez de perder el PM ya adjuntado.
            payment_behavior: "allow_incomplete",
            off_session: true,
          },
          { idempotencyKey: `sub-checkout-${sessionId}` },
        );

        await ctx.runMutation(
          internal.billing.internal.upsertStripeSubscriptionId,
          { clinicId, stripeSubscriptionId: sub.id },
        );
        // Aplicar el estado real de la S2 inmediatamente: sus webhooks
        // (`customer.subscription.created`, `invoice.paid`) pueden llegar
        // ANTES de que se persista el puntero y el filtro anti-zombi (H-1)
        // los descartaría como "sub ajena". Sin `eventCreatedMs` para no
        // sellar el ordering.
        const item = sub.items.data[0];
        await ctx.runMutation(internal.billing.internal.applySubscriptionEvent, {
          clinicId,
          status: sub.status,
          trialEnd: sub.trial_end ? sub.trial_end * 1000 : undefined,
          currentPeriodEnd: item?.current_period_end
            ? item.current_period_end * 1000
            : undefined,
          cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
          quantity: item?.quantity,
          stripeSubscriptionId: sub.id,
        });
        await syncStripeCustomerTierLabel(stripe, customerId, quantity, variante);
      }
    }

    await persistRegimen(ctx, clinicId, aplicado);
  },
});

/**
 * Recalcula y aplica el régimen fiscal de una clínica a partir de la
 * dirección actual de su customer. La dispara el webhook `customer.updated`
 * cuando cambia `address` o `tax_exempt` (el cliente editó la dirección en el
 * Customer Portal, o soporte en el Dashboard) y sirve también para reparar a
 * mano una clínica concreta.
 *
 * Nunca lanza: un fallo transitorio de Stripe no debe hacer que el webhook
 * reintente en bucle. Idempotente: si customer y sub ya están alineados, no
 * escribe, así que el `customer.updated` que provoca nuestro propio update
 * termina aquí sin efectos.
 */
export const syncRegimenFiscal = internalAction({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }): Promise<void> => {
    try {
      const data = await ctx.runQuery(
        internal.billing.internal.getBillingContext,
        { clinicId },
      );
      const customerId = data.billing?.stripeCustomerId;
      if (!customerId) return;

      const stripe = getStripeClient();
      const aplicado = await syncCustomerRegimen(stripe, customerId);

      const subId = data.billing?.stripeSubscriptionId;
      if (subId) {
        const sub = await stripe.subscriptions
          .retrieve(subId)
          .catch(() => null);
        if (sub) {
          await syncSubscriptionRegimen(stripe, sub, aplicado.regimen);
        }
      }

      await persistRegimen(ctx, clinicId, aplicado);
    } catch (err) {
      console.warn(
        `[billing] syncRegimenFiscal falló para clinic=${clinicId}: ${(err as Error).message}`,
      );
    }
  },
});

/**
 * Backfill puntual para la migración de Stripe Tax a Tax Rates manuales:
 * recorre todas las clínicas con customer, resuelve su régimen a partir de la
 * dirección del customer y alinea `tax_exempt`/footer del customer y
 * `default_tax_rates`/`automatic_tax` de la sub viva. Con `apply: false`
 * (default) solo informa de lo que cambiaría.
 *
 * Errores capturados por fila, como `backfillCustomerDescriptions`: las
 * filas que apuntan a customers de modo test fallan con `No such customer`
 * y no deben abortar el barrido.
 *
 *   npx convex run billing/actions:backfillRegimenFiscal '{"apply": false}'
 */
export const backfillRegimenFiscal = internalAction({
  args: { apply: v.optional(v.boolean()) },
  handler: async (
    ctx,
    { apply = false },
  ): Promise<{
    apply: boolean;
    revisadas: number;
    cambios: {
      clinicId: Id<"clinics">;
      nombre: string;
      customerId: string;
      regimen: RegimenFiscal;
      codigoPostal: string | null;
      customerPatch: boolean;
      subPatch: boolean;
    }[];
    yaCorrectas: number;
    fallidas: { clinicId: Id<"clinics">; customerId: string; motivo: string }[];
  }> => {
    const filas: {
      clinicId: Id<"clinics">;
      stripeCustomerId: string;
      stripeSubscriptionId: string | undefined;
      nombre: string;
    }[] = await ctx.runQuery(
      internal.billing.internal.listBillingConCustomer,
      {},
    );
    const stripe = getStripeClient();
    const igicId = getIgicTaxRateId();

    const cambios: {
      clinicId: Id<"clinics">;
      nombre: string;
      customerId: string;
      regimen: RegimenFiscal;
      codigoPostal: string | null;
      customerPatch: boolean;
      subPatch: boolean;
    }[] = [];
    let yaCorrectas = 0;
    const fallidas: {
      clinicId: Id<"clinics">;
      customerId: string;
      motivo: string;
    }[] = [];

    for (const fila of filas) {
      try {
        const customer = await stripe.customers.retrieve(fila.stripeCustomerId);
        if ("deleted" in customer) {
          fallidas.push({
            clinicId: fila.clinicId,
            customerId: fila.stripeCustomerId,
            motivo: "customer borrado en Stripe",
          });
          continue;
        }
        const regimen = resolveRegimenFiscal(customer.address);
        const customerPatch = buildCustomerRegimenPatch(customer, regimen);

        let sub: Stripe.Subscription | null = null;
        if (fila.stripeSubscriptionId) {
          sub = await stripe.subscriptions
            .retrieve(fila.stripeSubscriptionId)
            .catch(() => null);
        }
        const subPatch =
          sub && esSubscriptionActualizable(sub.status)
            ? buildSubscriptionRegimenPatch(sub, regimen, igicId)
            : null;

        if (!customerPatch && !subPatch) {
          yaCorrectas++;
          if (apply) {
            await ctx.runMutation(internal.billing.internal.setRegimenFiscal, {
              clinicId: fila.clinicId,
              regimenFiscal: regimen,
              paisFiscal: customer.address?.country ?? undefined,
              codigoPostalFiscal: customer.address?.postal_code ?? undefined,
            });
          }
          continue;
        }

        cambios.push({
          clinicId: fila.clinicId,
          nombre: fila.nombre,
          customerId: fila.stripeCustomerId,
          regimen,
          codigoPostal: customer.address?.postal_code ?? null,
          customerPatch: customerPatch !== null,
          subPatch: subPatch !== null,
        });

        if (apply) {
          if (customerPatch) {
            await stripe.customers.update(fila.stripeCustomerId, customerPatch);
          }
          if (sub && subPatch) {
            await stripe.subscriptions.update(sub.id, subPatch);
          }
          await ctx.runMutation(internal.billing.internal.setRegimenFiscal, {
            clinicId: fila.clinicId,
            regimenFiscal: regimen,
            paisFiscal: customer.address?.country ?? undefined,
            codigoPostalFiscal: customer.address?.postal_code ?? undefined,
          });
        }
      } catch (err) {
        fallidas.push({
          clinicId: fila.clinicId,
          customerId: fila.stripeCustomerId,
          motivo: (err as Error).message,
        });
      }
    }

    console.log(
      `[billing] backfillRegimenFiscal apply=${apply}: ${cambios.length} cambio(s), ${yaCorrectas} ya correcta(s), ${fallidas.length} fallida(s)`,
    );
    return { apply, revisadas: filas.length, cambios, yaCorrectas, fallidas };
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
 * Solicitud del admin de una clínica para contactar con ventas (caso +9
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
      `Solicitud de plan enterprise (+9 fisioterapeutas)`,
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
      asunto: `[Kengo] +9 fisios — ${data.clinic.nombre}`,
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
 * Vista previa de la próxima factura de la clínica, leída de Stripe en vivo.
 * Es la única fuente fiable del importe de un contrato a medida: Convex no
 * persiste precios y el price negociado puede llevar tramos o descuentos que
 * no queremos replicar. Importes en céntimos. Devuelve `null` (sin lanzar)
 * si la clínica no tiene sub viva o Stripe falla: la UI simplemente no pinta
 * el importe.
 */
export const getProximaFacturaForClinic = action({
  args: { clinicId: v.id("clinics") },
  handler: async (
    ctx,
    { clinicId },
  ): Promise<{
    subtotal: number;
    impuestos: number;
    total: number;
    moneda: string;
    fecha: number | null;
  } | null> => {
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
    const subscriptionId = billing?.stripeSubscriptionId;
    if (!customerId || !subscriptionId) return null;

    try {
      const stripe = getStripeClient();
      const preview = await stripe.invoices.createPreview({
        customer: customerId,
        subscription: subscriptionId,
      });
      const total = preview.total ?? 0;
      // `total_excluding_tax` ya descuenta cupones; si Stripe no lo informa
      // (sin impuestos configurados) el total es también el neto.
      const subtotal = preview.total_excluding_tax ?? total;
      const fechaSeg = preview.next_payment_attempt ?? preview.period_end;
      return {
        subtotal,
        impuestos: total - subtotal,
        total,
        moneda: preview.currency ?? "eur",
        fecha: fechaSeg ? fechaSeg * 1000 : null,
      };
    } catch (err) {
      // Una sub cancelada o sin próxima factura hace que Stripe rechace el
      // preview; no es un error de la pantalla.
      console.warn(
        `[billing] getProximaFacturaForClinic: sin preview para clinic=${clinicId}: ${(err as Error).message}`,
      );
      return null;
    }
  },
});

/**
 * Internal: fija la etiqueta "Plan a medida" en el customer de una clínica
 * con contrato a medida. La encola el webhook `customer.subscription.*`
 * cuando el price no es de autoservicio, para que la factura siguiente no
 * salga con el tramo anterior ("Plan Medium") aunque ventas cambie el price
 * desde el Dashboard sin pasar por la app.
 */
export const syncTierLabelAMedida = internalAction({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }): Promise<void> => {
    const billing = await ctx.runQuery(
      internal.billing.queries.getClinicBillingStatusInternal,
      { clinicId },
    );
    if (!billing?.stripeCustomerId || billing.limiteFisios === undefined) {
      return;
    }
    await syncStripeCustomerTierLabel(
      getStripeClient(),
      billing.stripeCustomerId,
      billing.limiteFisios,
      billing.variante ?? "base",
      true,
    );
  },
});

/**
 * Internal: actualiza la quantity de Stripe con prorrateo automático.
 * La encola `syncQuantityFromMemberships` cuando detecta cambios.
 */
export const updateStripeQuantity = internalAction({
  args: { clinicId: v.id("clinics"), quantity: v.number() },
  // El arg `quantity` se conserva por compatibilidad pero se IGNORA: la
  // cantidad se recomputa en ejecución (M-3).
  handler: async (ctx, { clinicId }): Promise<void> => {
    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );

    // M-3: recomputar la cantidad AHORA, no usar el valor congelado al encolar.
    // Dos cambios de plantilla casi simultáneos encolan dos actions cuyo orden
    // de ejecución Convex no garantiza; recomputando, la última en correr deja
    // Stripe con la cantidad real.
    const cantidad = Math.max(1, data.cantidadFisios);

    // Contrato a medida: la `quantity` de Stripe son las PLAZAS CONTRATADAS que
    // fijó ventas en el Dashboard, no el uso real. Reescribirla aquí borraría
    // el contrato, así que Stripe manda y no tocamos nada.
    // `syncQuantityFromMemberships` ya corta antes; esto es el cinturón por si
    // alguien encola la action directamente.
    if (data.billing?.limiteFisios !== undefined) return;

    // Por encima del tope de autoservicio tampoco empujamos: enterprise se
    // gestiona a mano (ver decisión de pricing) y `syncQuantityFromMemberships`
    // ya marca `requiereContactoVentas` en ese caso.
    if (data.cantidadFisios > LIMITE_FISIOS_AUTOSERVICIO) return;

    const localSubId = data.billing?.stripeSubscriptionId;
    const customerId = data.billing?.stripeCustomerId;
    if (!localSubId || !customerId) return;

    // M-5: self-heal del puntero si la sub local está muerta (cancelada), para
    // no fallar al actualizar la cantidad contra una S1 huérfana.
    const stripe = getStripeClient();
    const subId = await resolveActiveSubscriptionId(
      ctx,
      stripe,
      clinicId,
      localSubId,
      customerId,
    );

    await stripeApi.updateSubscriptionQuantity(ctx, {
      stripeSubscriptionId: subId,
      quantity: cantidad,
    });

    await syncStripeCustomerTierLabel(
      stripe,
      customerId,
      cantidad,
      data.billing?.variante ?? "base",
    );

    await ctx.runMutation(internal.billing.internal.upsertClinicBilling, {
      clinicId,
      cantidadFisios: cantidad,
    });
  },
});

/**
 * Reconciliación diaria de los contratos a medida. Relee de Stripe el price y
 * la `quantity` de cada suscripción viva y refresca `clinicBilling.limiteFisios`.
 *
 * Por qué hace falta: cuando ventas amplía las plazas desde el Stripe Dashboard,
 * el techo llega a Convex por webhook. Si ese webhook se pierde, ventas cree
 * haber ampliado la clínica y el cliente sigue bloqueado — un fallo silencioso
 * que nadie detecta hasta que el cliente se queja. Esto lo cierra en 24 h.
 *
 * Idempotente: `setLimiteFisios` no escribe si el valor ya coincide.
 */
export const reconcileLimitesAMedida = internalAction({
  args: {},
  handler: async (ctx): Promise<{ revisadas: number; ajustadas: number }> => {
    const filas = await ctx.runQuery(
      internal.billing.internal.listBillingConSubscription,
      {},
    );
    if (filas.length === 0) return { revisadas: 0, ajustadas: 0 };

    const stripe = getStripeClient();
    const conocidos = [
      process.env["STRIPE_PRICE_ID_BASE"],
      process.env["STRIPE_PRICE_ID_ILIMITADO"],
      process.env["STRIPE_PRICE_ID"],
    ];

    let ajustadas = 0;
    for (const fila of filas) {
      try {
        const sub = await stripe.subscriptions.retrieve(
          fila.stripeSubscriptionId,
        );
        // Una sub muerta no describe el contrato vigente: dejarla en paz evita
        // limpiar el techo de una clínica que solo cambió de subscription.
        if (sub.status === "canceled" || sub.status === "incomplete_expired") {
          continue;
        }

        const item = sub.items.data[0];
        const esAMedida = esPriceAMedida(item?.price?.id, conocidos);
        const limite = esAMedida ? (item?.quantity ?? null) : null;

        const { cambiado } = await ctx.runMutation(
          internal.billing.internal.setLimiteFisios,
          { clinicId: fila.clinicId, limiteFisios: limite },
        );
        if (!cambiado) continue;

        ajustadas++;
        console.log(
          `[billing] reconcileLimitesAMedida: clinic=${fila.clinicId} limiteFisios ${fila.limiteFisios ?? "—"} → ${limite ?? "—"}`,
        );

        // La etiqueta de la factura sigue al contrato.
        if (fila.stripeCustomerId) {
          await syncStripeCustomerTierLabel(
            stripe,
            fila.stripeCustomerId,
            limite ?? 0,
            fila.variante ?? "base",
            esAMedida,
          );
        }
      } catch (err) {
        // Una clínica que falle no debe abortar el barrido completo.
        console.error(
          `[billing] reconcileLimitesAMedida: fallo en clinic=${fila.clinicId}: ${(err as Error).message}`,
        );
      }
    }

    return { revisadas: filas.length, ajustadas };
  },
});

/**
 * Backfill manual desde Convex Dashboard. Para una clínica concreta, busca
 * en Stripe la sub viva más reciente del customer y la persiste en
 * `clinicBilling.stripeSubscriptionId`. Idempotente. Útil para saneos
 * masivos de clínicas creadas antes del fix de `finalizeSubscriptionCheckout`
 * que pueden tener el `stripeSubscriptionId` apuntando a una S1 huérfana.
 *
 * Args: `{ "clinicId": "<id>" }`.
 */
export const recoverClinicSubscriptionId = internalAction({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }): Promise<{ ok: true; subId: string | null }> => {
    const data = await ctx.runQuery(
      internal.billing.internal.getBillingContext,
      { clinicId },
    );
    const customerId = data.billing?.stripeCustomerId;
    if (!customerId) return { ok: true, subId: null } as const;

    const stripe = getStripeClient();
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const alive = subs.data
      .filter(
        (s) =>
          s.status !== "canceled" && s.status !== "incomplete_expired",
      )
      .sort((a, b) => b.created - a.created)[0];
    if (!alive) return { ok: true, subId: null } as const;

    await ctx.runMutation(
      internal.billing.internal.upsertStripeSubscriptionId,
      { clinicId, stripeSubscriptionId: alive.id },
    );
    return { ok: true, subId: alive.id } as const;
  },
});

/**
 * Migración pricing v2 (Lonely/Smart/Medium): mueve todas las suscripciones
 * que sigan en el price antiguo al price base nuevo y persiste
 * `variante: "base"` en `clinicBilling`. Idempotente y repetible — pensada
 * para ejecutarse desde el Convex Dashboard tras crear los prices nuevos y
 * configurar `STRIPE_PRICE_ID_BASE`/`STRIPE_PRICE_ID_ILIMITADO`.
 *
 * `proration_behavior: "none"`: el precio nuevo aplica en la SIGUIENTE
 * factura, sin línea de ajuste a mitad de ciclo. Una sub `trialing` no cobra
 * nada en el swap (la primera factura post-trial ya sale al precio nuevo) y
 * una `past_due` conserva intacta su factura en dunning.
 *
 * Args: `{ "oldPriceId": "price_…", "dryRun": true }`.
 */
export const migrateSubscriptionsToPricingV2 = internalAction({
  args: {
    /** Price antiguo a sustituir (explícito: el env var ya puede estar rotado). */
    oldPriceId: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { oldPriceId, dryRun },
  ): Promise<{
    revisadas: number;
    migradas: string[];
    saltadas: { clinicId: string; motivo: string }[];
  }> => {
    const basePriceId = getEnv("STRIPE_PRICE_ID_BASE");
    const stripe = getStripeClient();
    const rows = await ctx.runQuery(
      internal.billing.internal.listAllClinicBilling,
      {},
    );

    const migradas: string[] = [];
    const saltadas: { clinicId: string; motivo: string }[] = [];

    for (const row of rows) {
      const subId = row.stripeSubscriptionId;
      if (!subId) {
        saltadas.push({ clinicId: row.clinicId, motivo: "sin subscription" });
        continue;
      }

      const sub = await stripe.subscriptions
        .retrieve(subId)
        .catch(() => null);
      if (!sub) {
        saltadas.push({ clinicId: row.clinicId, motivo: "sub no encontrada" });
        continue;
      }
      if (sub.status === "canceled" || sub.status === "incomplete_expired") {
        saltadas.push({ clinicId: row.clinicId, motivo: `sub ${sub.status}` });
        continue;
      }

      const item = sub.items.data[0];
      if (!item || item.price.id !== oldPriceId) {
        saltadas.push({
          clinicId: row.clinicId,
          motivo: `price ya es ${item?.price.id ?? "desconocido"}`,
        });
        continue;
      }

      if (dryRun) {
        migradas.push(row.clinicId);
        continue;
      }

      await stripe.subscriptions.update(subId, {
        items: [
          {
            id: item.id,
            price: basePriceId,
            quantity: item.quantity ?? 1,
          },
        ],
        proration_behavior: "none",
      });

      await ctx.runMutation(internal.billing.internal.upsertClinicBilling, {
        clinicId: row.clinicId,
        variante: "base",
      });

      if (row.stripeCustomerId) {
        await syncStripeCustomerTierLabel(
          stripe,
          row.stripeCustomerId,
          Math.max(1, item.quantity ?? row.cantidadFisios ?? 1),
          "base",
        );
      }

      migradas.push(row.clinicId);
      console.log(
        `[billing] migrateSubscriptionsToPricingV2 clinic=${row.clinicId} sub=${subId} → ${basePriceId}`,
      );
    }

    return { revisadas: rows.length, migradas, saltadas };
  },
});

/**
 * Rellena el `description` de los customers de Stripe ya creados con el nombre
 * de su clínica. One-shot para el parque existente; lo nuevo ya nace con él
 * desde `syncCustomerDefaults`.
 *
 * Sin esto, un fisio con varias clínicas aparece en el Dashboard como N
 * customers con su mismo nombre y correo, y ventas solo puede distinguirlos
 * abriendo cada uno a comprobar el `metadata.orgId` — que es justo lo que pide
 * `docs/GUIA_ENTERPRISE_VENTAS.md` antes de tocar plazas o precio.
 *
 * Dry-run por defecto (`apply: false`), como `dropStaleClinicBilling`.
 *
 * Los errores se capturan **por customer**: las clínicas cuya fila todavía
 * apunta a un customer de modo test fallan con `No such customer`, y eso no
 * debe abortar el barrido de las demás. Salen listadas en `fallidas`.
 */
export const backfillCustomerDescriptions = internalAction({
  args: { apply: v.optional(v.boolean()) },
  handler: async (
    ctx,
    { apply = false },
  ): Promise<{
    apply: boolean;
    revisadas: number;
    actualizables: { customerId: string; nombre: string }[];
    yaCorrectas: number;
    fallidas: { customerId: string; motivo: string }[];
  }> => {
    // Anotado a mano porque `listBillingConCustomer` aún no está en el api
    // generado: `convex codegen` haría push real a producción.
    const filas: {
      clinicId: Id<"clinics">;
      stripeCustomerId: string;
      nombre: string;
    }[] = await ctx.runQuery(
      internal.billing.internal.listBillingConCustomer,
      {},
    );
    const stripe = getStripeClient();

    const actualizables: { customerId: string; nombre: string }[] = [];
    const yaCorrectas: string[] = [];
    const fallidas: { customerId: string; motivo: string }[] = [];

    for (const fila of filas) {
      try {
        const customer = await stripe.customers.retrieve(fila.stripeCustomerId);
        if ("deleted" in customer) {
          fallidas.push({
            customerId: fila.stripeCustomerId,
            motivo: "customer borrado en Stripe",
          });
          continue;
        }
        if (customer.description === fila.nombre) {
          yaCorrectas.push(fila.stripeCustomerId);
          continue;
        }
        actualizables.push({
          customerId: fila.stripeCustomerId,
          nombre: fila.nombre,
        });
        if (apply) {
          await stripe.customers.update(fila.stripeCustomerId, {
            description: fila.nombre,
          });
        }
      } catch (err) {
        fallidas.push({
          customerId: fila.stripeCustomerId,
          motivo: (err as Error).message,
        });
      }
    }

    console.log(
      `[billing] backfillCustomerDescriptions apply=${apply}: ${actualizables.length} actualizable(s), ${yaCorrectas.length} ya correcta(s), ${fallidas.length} fallida(s)`,
    );
    return {
      apply,
      revisadas: filas.length,
      actualizables,
      yaCorrectas: yaCorrectas.length,
      fallidas,
    };
  },
});

/**
 * Backfill puntual: alinea `email`/`name` de los customers con el owner
 * actual de cada clínica. Cubre las transferencias anteriores a que
 * `syncCustomerOwner` existiera y cualquier `runAfter` que fallara. El nombre
 * del owner saliente sale del último `clinicOwnershipAudit`, así que un name
 * que ya sea razón social no se toca (ver `buildCustomerOwnerPatch`).
 *
 * Dry-run por defecto y errores capturados por customer, como
 * `backfillCustomerDescriptions`.
 */
export const backfillCustomerOwners = internalAction({
  args: { apply: v.optional(v.boolean()) },
  handler: async (
    ctx,
    { apply = false },
  ): Promise<{
    apply: boolean;
    revisadas: number;
    actualizables: {
      clinicId: Id<"clinics">;
      customerId: string;
      patch: CustomerOwnerPatch;
    }[];
    yaCorrectas: number;
    fallidas: { clinicId: Id<"clinics">; customerId: string; motivo: string }[];
  }> => {
    const filas: {
      clinicId: Id<"clinics">;
      stripeCustomerId: string;
      nombre: string;
    }[] = await ctx.runQuery(
      internal.billing.internal.listBillingConCustomer,
      {},
    );
    const stripe = getStripeClient();

    const actualizables: {
      clinicId: Id<"clinics">;
      customerId: string;
      patch: CustomerOwnerPatch;
    }[] = [];
    let yaCorrectas = 0;
    const fallidas: {
      clinicId: Id<"clinics">;
      customerId: string;
      motivo: string;
    }[] = [];

    for (const fila of filas) {
      try {
        const data: CustomerOwnerSyncContext = await ctx.runQuery(
          internal.billing.internal.getCustomerOwnerSyncContext,
          { clinicId: fila.clinicId },
        );
        const patch = await resolveCustomerOwnerPatch(
          stripe,
          fila.stripeCustomerId,
          data,
        );
        if (!patch) {
          yaCorrectas++;
          continue;
        }
        actualizables.push({
          clinicId: fila.clinicId,
          customerId: fila.stripeCustomerId,
          patch,
        });
        if (apply) {
          await stripe.customers.update(fila.stripeCustomerId, patch);
        }
      } catch (err) {
        fallidas.push({
          clinicId: fila.clinicId,
          customerId: fila.stripeCustomerId,
          motivo: (err as Error).message,
        });
      }
    }

    console.log(
      `[billing] backfillCustomerOwners apply=${apply}: ${actualizables.length} actualizable(s), ${yaCorrectas} ya correcta(s), ${fallidas.length} fallida(s)`,
    );
    return {
      apply,
      revisadas: filas.length,
      actualizables,
      yaCorrectas,
      fallidas,
    };
  },
});

// ─── Titularidad del método de pago ───

/**
 * Deja constancia en el propio PaymentMethod de Stripe de quién lo aportó
 * (`metadata`), para que soporte lo vea en el Dashboard sin abrir Convex.
 * Fire-and-forget: nunca lanza.
 */
export const stampPaymentMethodMetadata = internalAction({
  args: { stripePaymentMethodId: v.string() },
  handler: async (ctx, { stripePaymentMethodId }): Promise<void> => {
    try {
      const info: { clinicId: Id<"clinics">; userId: Id<"users">; email: string } | null =
        await ctx.runQuery(internal.billing.paymentMethods.getContributorInfo, {
          stripePaymentMethodId,
        });
      if (!info) return;
      const stripe = getStripeClient();
      await stripe.paymentMethods.update(stripePaymentMethodId, {
        metadata: {
          orgId: info.clinicId,
          aportadaPorUserId: info.userId,
          aportadaPorEmail: info.email,
        },
      });
    } catch (err) {
      console.warn(
        `[billing] stampPaymentMethodMetadata falló para pm=${stripePaymentMethodId}: ${(err as Error).message}`,
      );
    }
  },
});

/**
 * Avisa al owner de que la tarjeta que cobraba se ha retirado. Se programa con
 * retardo desde el webhook/acción de retirada; `getAvisoRetiradaContext`
 * devuelve `null` si entre tanto llegó otra tarjeta, si ya se envió o si quien
 * la retiró es el propio owner.
 */
export const notifyMetodoPagoRetirado = internalAction({
  args: { stripePaymentMethodId: v.string() },
  handler: async (ctx, { stripePaymentMethodId }): Promise<void> => {
    const data = await ctx.runQuery(
      internal.billing.paymentMethods.getAvisoRetiradaContext,
      { stripePaymentMethodId },
    );
    if (!data) return;
    const appUrl = getAppUrlOrFallback();
    const enviado = await ctx.runAction(
      internal.email.actions.sendPaymentMethodRemovedEmail,
      {
        to: data.owner.email,
        nombreOwner: data.owner.name,
        clinicaNombre: data.clinicaNombre,
        retiradaPorNombre: data.retiradaPorNombre,
        tarjeta: { marca: data.tarjeta.marca, ultimos4: data.tarjeta.ultimos4 },
        proximoCobro: data.proximoCobro,
        portalUrl: `${appUrl}/mi-clinica/suscripcion`,
      },
    );
    if (enviado) {
      await ctx.runMutation(
        internal.billing.paymentMethods.markAvisoRetiradaEnviado,
        { filaId: data.filaId },
      );
    }
  },
});

/**
 * Desvincula un PM en Stripe y lo marca localmente. Base compartida por la
 * retirada del titular y por la transferencia con "retirar mi tarjeta". Si
 * era el que cobraba y quien lo retira no es el owner, programa el aviso.
 */
async function retirarPaymentMethod(
  ctx: ActionCtx,
  stripe: Stripe,
  args: {
    stripePaymentMethodId: string;
    byUserId: Id<"users">;
    via: "titular" | "transfer";
  },
): Promise<{ eraActiva: boolean }> {
  try {
    await stripe.paymentMethods.detach(args.stripePaymentMethodId);
  } catch (err) {
    // Ya desvinculado en Stripe (p.ej. desde el Portal) → solo alinear local.
    const msg = (err as Error).message ?? "";
    if (!/not attached|No such payment_method/i.test(msg)) throw err;
    console.warn(
      `[billing] retirarPaymentMethod pm=${args.stripePaymentMethodId} ya no estaba adjunto en Stripe: ${msg}`,
    );
  }
  const res: { eraActiva: boolean } = await ctx.runMutation(
    internal.billing.paymentMethods.markDetached,
    {
      stripePaymentMethodId: args.stripePaymentMethodId,
      byUserId: args.byUserId,
      via: args.via,
    },
  );
  if (res.eraActiva) {
    await ctx.scheduler.runAfter(
      0,
      internal.billing.actions.notifyMetodoPagoRetirado,
      { stripePaymentMethodId: args.stripePaymentMethodId },
    );
  }
  return { eraActiva: res.eraActiva };
}

/**
 * El titular de una tarjeta la retira desde su cuenta. No exige ser owner ni
 * miembro de la clínica: la titularidad sobrevive a ambas cosas. No corta el
 * servicio: la clínica sigue hasta la siguiente renovación y entonces aplica
 * la gracia habitual si nadie añadió otra tarjeta.
 */
export const retirarMiMetodoDePago = action({
  args: { stripePaymentMethodId: v.string() },
  handler: async (
    ctx,
    { stripePaymentMethodId },
  ): Promise<{ eraActiva: boolean }> => {
    const externalId = await requireExternalId(ctx);
    const fila: { userId: Id<"users">; clinicId: Id<"clinics">; ownerUserId: Id<"users"> } =
      await ctx.runQuery(internal.billing.paymentMethods.getForContributor, {
        externalId,
        stripePaymentMethodId,
      });
    const stripe = getStripeClient();
    const res = await retirarPaymentMethod(ctx, stripe, {
      stripePaymentMethodId,
      byUserId: fila.userId,
      via: "titular",
    });
    console.log(
      `[billing] retirarMiMetodoDePago clinic=${fila.clinicId} pm=${stripePaymentMethodId} user=${fila.userId} eraActiva=${res.eraActiva}`,
    );
    return res;
  },
});

/**
 * Al transferir la propiedad eligiendo "retirar mi tarjeta": desvincula todas
 * las tarjetas vivas que el owner saliente aportó a esa clínica. Fire-and-forget
 * desde `transferOwnership`; el email de transferencia se encadena después
 * para que refleje el estado final.
 */
export const retirarMetodosDePagoDeUsuarioEnClinica = internalAction({
  args: {
    clinicId: v.id("clinics"),
    userId: v.id("users"),
    toUserId: v.id("users"),
  },
  handler: async (ctx, { clinicId, userId, toUserId }): Promise<void> => {
    const vivas: MetodoDePagoAportado[] = await ctx.runQuery(
      internal.billing.paymentMethods.listByUser,
      { userId, clinicId },
    );
    const stripe = getStripeClient();
    let retiradas = 0;
    for (const pm of vivas) {
      try {
        await retirarPaymentMethod(ctx, stripe, {
          stripePaymentMethodId: pm.id,
          byUserId: userId,
          via: "transfer",
        });
        retiradas++;
      } catch (err) {
        console.error(
          `[billing] retirarMetodosDePagoDeUsuarioEnClinica clinic=${clinicId} pm=${pm.id}: ${(err as Error).message}`,
        );
      }
    }
    console.log(
      `[billing] retirarMetodosDePagoDeUsuarioEnClinica clinic=${clinicId} user=${userId}: ${retiradas}/${vivas.length} retirada(s)`,
    );
    await ctx.runAction(internal.billing.actions.notifyOwnershipTransferred, {
      clinicId,
      fromUserId: userId,
      toUserId,
      tarjetaRetirada: retiradas > 0,
    });
  },
});

/**
 * Emails de transferencia de propiedad (a ambos owners). Se programa desde
 * `transferOwnership` (o al final de la retirada de tarjetas si la hubo) y
 * desde `forceTransferOwnership` (solo al nuevo owner: `fromUserId` ausente).
 */
export const notifyOwnershipTransferred = internalAction({
  args: {
    clinicId: v.id("clinics"),
    fromUserId: v.optional(v.id("users")),
    toUserId: v.id("users"),
    tarjetaRetirada: v.boolean(),
  },
  handler: async (
    ctx,
    { clinicId, fromUserId, toUserId, tarjetaRetirada },
  ): Promise<void> => {
    const data: {
      clinicaNombre: string;
      nuevo: { email: string; nombre: string } | null;
      anterior: { email: string; nombre: string } | null;
      hayTarjetaActiva: boolean;
      teniaTarjeta: boolean;
      proximoCobro?: number;
    } = await ctx.runQuery(
      internal.billing.internal.getOwnershipTransferEmailContext,
      { clinicId, fromUserId, toUserId },
    );
    if (!data.nuevo) return;
    const appUrl = getAppUrlOrFallback();
    await ctx.runAction(internal.email.actions.sendOwnershipTransferredEmails, {
      clinicaNombre: data.clinicaNombre,
      nuevo: { to: data.nuevo.email, nombre: data.nuevo.nombre },
      anterior: data.anterior
        ? { to: data.anterior.email, nombre: data.anterior.nombre }
        : undefined,
      tarjetaRetirada,
      hayTarjetaActiva: data.hayTarjetaActiva,
      teniaTarjeta: data.teniaTarjeta,
      proximoCobro: data.proximoCobro,
      portalUrl: `${appUrl}/mi-clinica/suscripcion`,
      cuentaUrl: `${appUrl}/perfil`,
    });
  },
});

/**
 * Espejo Stripe → `clinicPaymentMethods`: da de alta los PM que faltan
 * (atribuidos a quien era owner cuando se adjuntaron, vía `ownerEnFecha`),
 * marca detached los que ya no están en Stripe y refresca los defaults.
 * Sirve de backfill inicial (dry-run por defecto) y de red de seguridad
 * diaria (cron con `apply: true`). Errores por clínica en `fallidas`.
 */
export const reconcilePaymentMethods = internalAction({
  args: { apply: v.optional(v.boolean()) },
  handler: async (
    ctx,
    { apply = false },
  ): Promise<{
    apply: boolean;
    revisadas: number;
    altas: { clinicId: Id<"clinics">; pm: string; aportadaPorUserId: Id<"users">; tarjeta: string }[];
    bajas: { clinicId: Id<"clinics">; pm: string }[];
    defaultsActualizados: number;
    fallidas: { clinicId: Id<"clinics">; customerId: string; motivo: string }[];
  }> => {
    const filas: {
      clinicId: Id<"clinics">;
      stripeCustomerId: string;
      nombre: string;
    }[] = await ctx.runQuery(
      internal.billing.internal.listBillingConCustomer,
      {},
    );
    const stripe = getStripeClient();

    const altas: { clinicId: Id<"clinics">; pm: string; aportadaPorUserId: Id<"users">; tarjeta: string }[] = [];
    const bajas: { clinicId: Id<"clinics">; pm: string }[] = [];
    const fallidas: { clinicId: Id<"clinics">; customerId: string; motivo: string }[] = [];
    let defaultsActualizados = 0;

    for (const fila of filas) {
      try {
        const contexto = await ctx.runQuery(
          internal.billing.paymentMethods.getReconcileContext,
          { clinicId: fila.clinicId },
        );
        if (!contexto) continue;

        const enStripe = await stripe.customers.listPaymentMethods(
          fila.stripeCustomerId,
          { limit: 100 },
        );
        const idsStripe = new Set(enStripe.data.map((pm) => pm.id));
        const idsLocales = new Set(contexto.vivas.map((f) => f.stripePaymentMethodId));

        for (const pm of enStripe.data) {
          if (idsLocales.has(pm.id)) continue;
          const creadoMs = pm.created * 1000;
          const aportadaPorUserId = ownerEnFecha(
            contexto.audits,
            contexto.ownerUserId,
            creadoMs,
          );
          const tarjeta = resumenTarjeta(pm);
          altas.push({
            clinicId: fila.clinicId,
            pm: pm.id,
            aportadaPorUserId,
            tarjeta: `${tarjeta.marca ?? tarjeta.tipo} ${tarjeta.ultimos4 ?? ""}`.trim(),
          });
          if (apply) {
            await ctx.runMutation(internal.billing.paymentMethods.upsertFromStripe, {
              clinicId: fila.clinicId,
              stripeCustomerId: fila.stripeCustomerId,
              stripePaymentMethodId: pm.id,
              ...tarjeta,
              attachedAtMs: creadoMs,
              origen: contexto.vivas.length === 0 ? "backfill" : "reconcile",
              aportadaPorUserId,
            });
            if (!pm.metadata?.["aportadaPorUserId"]) {
              await ctx.scheduler.runAfter(
                0,
                internal.billing.actions.stampPaymentMethodMetadata,
                { stripePaymentMethodId: pm.id },
              );
            }
          }
        }

        for (const local of contexto.vivas) {
          if (idsStripe.has(local.stripePaymentMethodId)) continue;
          bajas.push({ clinicId: fila.clinicId, pm: local.stripePaymentMethodId });
          if (apply) {
            const res: { eraActiva: boolean } = await ctx.runMutation(
              internal.billing.paymentMethods.markDetached,
              { stripePaymentMethodId: local.stripePaymentMethodId, via: "stripe" },
            );
            if (res.eraActiva) {
              await ctx.scheduler.runAfter(
                0,
                internal.billing.actions.notifyMetodoPagoRetirado,
                { stripePaymentMethodId: local.stripePaymentMethodId },
              );
            }
          }
        }

        if (apply) {
          const customer = await stripe.customers.retrieve(fila.stripeCustomerId);
          const customerDefault =
            "deleted" in customer
              ? null
              : (idDeRef(customer.invoice_settings?.default_payment_method) ?? null);
          let subscriptionDefault: string | null = null;
          if (contexto.stripeSubscriptionId) {
            const sub = await stripe.subscriptions.retrieve(contexto.stripeSubscriptionId);
            subscriptionDefault = idDeRef(sub.default_payment_method) ?? null;
          }
          await ctx.runMutation(
            internal.billing.paymentMethods.setDefaultPaymentMethods,
            { clinicId: fila.clinicId, subscriptionDefault, customerDefault },
          );
          defaultsActualizados++;
        }
      } catch (err) {
        fallidas.push({
          clinicId: fila.clinicId,
          customerId: fila.stripeCustomerId,
          motivo: (err as Error).message,
        });
      }
    }

    console.log(
      `[billing] reconcilePaymentMethods apply=${apply}: ${altas.length} alta(s), ${bajas.length} baja(s), ${fallidas.length} fallida(s)`,
    );
    return { apply, revisadas: filas.length, altas, bajas, defaultsActualizados, fallidas };
  },
});
