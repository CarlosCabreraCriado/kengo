import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  debeMarcarPendiente,
  defaultPaymentMethodDe,
  type ResumenTarjeta,
} from "./_helpers";
import { nombreCompleto } from "./internal";

/**
 * Titularidad de los métodos de pago (`clinicPaymentMethods`): espejo local de
 * los PaymentMethods del customer de cada clínica con la persona que los
 * aportó. Lo alimentan el webhook `payment_method.*`, `finalizeSetupCheckout`,
 * la acción de retirada y la reconciliación diaria; todo idempotente por
 * `stripePaymentMethodId`.
 *
 * Reglas:
 * - Una fila nueva se atribuye al **owner actual** de la clínica salvo que el
 *   caller (reconciliación) traiga una atribución mejor (`ownerEnFecha`).
 * - Una fila detached nunca se borra; sirve de historial.
 * - `metodoPagoPendienteDesde` se sella al retirarse el PM que cobraba con la
 *   suscripción viva y se limpia al adjuntarse un PM o al fijarse un default
 *   vivo.
 */

const detachedVia = v.union(
  v.literal("titular"),
  v.literal("transfer"),
  v.literal("stripe"),
);

const resumenTarjetaArgs = {
  tipo: v.string(),
  marca: v.optional(v.string()),
  ultimos4: v.optional(v.string()),
  caducaMes: v.optional(v.number()),
  caducaAnio: v.optional(v.number()),
};

async function billingDe(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
): Promise<Doc<"clinicBilling"> | null> {
  return await ctx.db
    .query("clinicBilling")
    .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
    .unique();
}

async function filaPorPm(
  ctx: QueryCtx | MutationCtx,
  stripePaymentMethodId: string,
): Promise<Doc<"clinicPaymentMethods"> | null> {
  return await ctx.db
    .query("clinicPaymentMethods")
    .withIndex("by_stripePaymentMethodId", (q) =>
      q.eq("stripePaymentMethodId", stripePaymentMethodId),
    )
    .first();
}

/**
 * Si el default derivado apunta a un PM vivo, el pendiente ya no aplica.
 */
async function limpiarPendienteSiHayDefaultVivo(
  ctx: MutationCtx,
  billing: Doc<"clinicBilling">,
): Promise<void> {
  if (billing.metodoPagoPendienteDesde === undefined) return;
  const activo = defaultPaymentMethodDe(billing);
  if (!activo) return;
  const fila = await filaPorPm(ctx, activo);
  // Sin fila local no podemos afirmar que esté vivo: lo resolverá el
  // `payment_method.attached` correspondiente o la reconciliación.
  if (!fila || fila.detachedAt !== undefined) return;
  await ctx.db.patch(billing._id, {
    metodoPagoPendienteDesde: undefined,
    metodoPagoRetiradoPorUserId: undefined,
    actualizadoEn: Date.now(),
  });
}

/** Clínica dueña de un customer de Stripe (para eventos sin `metadata.orgId`). */
export const getClinicIdByCustomer = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, { stripeCustomerId }): Promise<Id<"clinics"> | null> => {
    const billing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", stripeCustomerId),
      )
      .first();
    return billing?.clinicId ?? null;
  },
});

/**
 * Alta o refresco de un PM adjunto al customer. Sin `aportadaPorUserId` se
 * atribuye al owner actual. Un PM ya detached no revive (Stripe no permite
 * re-adjuntar un PM desvinculado; si llega, es un evento tardío).
 */
export const upsertFromStripe = internalMutation({
  args: {
    clinicId: v.id("clinics"),
    stripeCustomerId: v.string(),
    stripePaymentMethodId: v.string(),
    ...resumenTarjetaArgs,
    attachedAtMs: v.number(),
    origen: v.union(
      v.literal("webhook"),
      v.literal("backfill"),
      v.literal("reconcile"),
    ),
    aportadaPorUserId: v.optional(v.id("users")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ creada: boolean; aportadaPorUserId: Id<"users"> | null }> => {
    const existente = await filaPorPm(ctx, args.stripePaymentMethodId);
    if (existente) {
      await ctx.db.patch(existente._id, {
        marca: args.marca,
        ultimos4: args.ultimos4,
        caducaMes: args.caducaMes,
        caducaAnio: args.caducaAnio,
      });
      return { creada: false, aportadaPorUserId: existente.aportadaPorUserId };
    }

    const clinic = await ctx.db.get(args.clinicId);
    if (!clinic) return { creada: false, aportadaPorUserId: null };
    const aportadaPorUserId = args.aportadaPorUserId ?? clinic.ownerUserId;

    await ctx.db.insert("clinicPaymentMethods", {
      clinicId: args.clinicId,
      stripeCustomerId: args.stripeCustomerId,
      stripePaymentMethodId: args.stripePaymentMethodId,
      aportadaPorUserId,
      tipo: args.tipo,
      marca: args.marca,
      ultimos4: args.ultimos4,
      caducaMes: args.caducaMes,
      caducaAnio: args.caducaAnio,
      attachedAt: args.attachedAtMs,
      origen: args.origen,
    });

    // Ha llegado una tarjeta nueva: el aviso de "método de pago pendiente"
    // deja de tener sentido aunque el default tarde en llegar.
    const billing = await billingDe(ctx, args.clinicId);
    if (billing?.metodoPagoPendienteDesde !== undefined && billing) {
      await ctx.db.patch(billing._id, {
        metodoPagoPendienteDesde: undefined,
        metodoPagoRetiradoPorUserId: undefined,
        actualizadoEn: Date.now(),
      });
    }

    return { creada: true, aportadaPorUserId };
  },
});

/**
 * Marca un PM como desvinculado. Idempotente. Si era el que cobraba y la
 * suscripción sigue viva, sella el pendiente y lo señala en el resultado para
 * que el caller avise al owner.
 */
export const markDetached = internalMutation({
  args: {
    stripePaymentMethodId: v.string(),
    byUserId: v.optional(v.id("users")),
    via: detachedVia,
  },
  handler: async (
    ctx,
    { stripePaymentMethodId, byUserId, via },
  ): Promise<{
    encontrada: boolean;
    yaEstaba: boolean;
    eraActiva: boolean;
    clinicId: Id<"clinics"> | null;
  }> => {
    const fila = await filaPorPm(ctx, stripePaymentMethodId);
    if (!fila) {
      return { encontrada: false, yaEstaba: false, eraActiva: false, clinicId: null };
    }
    if (fila.detachedAt !== undefined) {
      return { encontrada: true, yaEstaba: true, eraActiva: false, clinicId: fila.clinicId };
    }

    await ctx.db.patch(fila._id, {
      detachedAt: Date.now(),
      detachedByUserId: byUserId,
      detachedVia: via,
    });

    const billing = await billingDe(ctx, fila.clinicId);
    if (!billing) {
      return { encontrada: true, yaEstaba: false, eraActiva: false, clinicId: fila.clinicId };
    }

    const defaultActual = defaultPaymentMethodDe(billing);
    const eraActiva = debeMarcarPendiente({
      pmRetirado: stripePaymentMethodId,
      defaultActual,
      estadoLocal: billing.estadoLocal,
    });

    const patch: Partial<Doc<"clinicBilling">> = { actualizadoEn: Date.now() };
    if (billing.stripeSubscriptionDefaultPaymentMethodId === stripePaymentMethodId) {
      patch.stripeSubscriptionDefaultPaymentMethodId = undefined;
    }
    if (billing.stripeCustomerDefaultPaymentMethodId === stripePaymentMethodId) {
      patch.stripeCustomerDefaultPaymentMethodId = undefined;
    }
    if (eraActiva) {
      patch.metodoPagoPendienteDesde = Date.now();
      patch.metodoPagoRetiradoPorUserId = byUserId ?? fila.aportadaPorUserId;
    }
    await ctx.db.patch(billing._id, patch);

    return { encontrada: true, yaEstaba: false, eraActiva, clinicId: fila.clinicId };
  },
});

/**
 * Espejo de los defaults de Stripe. `null` borra el valor; `undefined` no lo
 * toca (la fuente correspondiente no venía en el evento).
 */
export const setDefaultPaymentMethods = internalMutation({
  args: {
    clinicId: v.id("clinics"),
    subscriptionDefault: v.optional(v.union(v.string(), v.null())),
    customerDefault: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { clinicId, subscriptionDefault, customerDefault }) => {
    const billing = await billingDe(ctx, clinicId);
    if (!billing) return;
    const patch: Partial<Doc<"clinicBilling">> = {};
    if (
      subscriptionDefault !== undefined &&
      (subscriptionDefault ?? undefined) !==
        billing.stripeSubscriptionDefaultPaymentMethodId
    ) {
      patch.stripeSubscriptionDefaultPaymentMethodId =
        subscriptionDefault ?? undefined;
    }
    if (
      customerDefault !== undefined &&
      (customerDefault ?? undefined) !==
        billing.stripeCustomerDefaultPaymentMethodId
    ) {
      patch.stripeCustomerDefaultPaymentMethodId = customerDefault ?? undefined;
    }
    if (Object.keys(patch).length === 0) return;
    patch.actualizadoEn = Date.now();
    await ctx.db.patch(billing._id, patch);
    await limpiarPendienteSiHayDefaultVivo(ctx, { ...billing, ...patch });
  },
});

/**
 * Fila de un PM comprobando que quien pide es su titular. No exige ser owner
 * ni miembro de la clínica: la titularidad sobrevive a ambas cosas.
 */
export const getForContributor = internalQuery({
  args: { externalId: v.string(), stripePaymentMethodId: v.string() },
  handler: async (
    ctx,
    { externalId, stripePaymentMethodId },
  ): Promise<{
    userId: Id<"users">;
    clinicId: Id<"clinics">;
    ownerUserId: Id<"users">;
  }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    if (!user) throw new Error("Usuario no encontrado");

    const fila = await filaPorPm(ctx, stripePaymentMethodId);
    if (!fila || fila.aportadaPorUserId !== user._id) {
      throw new ConvexError({
        code: "PM_NOT_CONTRIBUTOR",
        message: "Solo quien aportó esta tarjeta puede retirarla.",
      });
    }
    if (fila.detachedAt !== undefined) {
      throw new ConvexError({
        code: "PM_ALREADY_DETACHED",
        message: "Esta tarjeta ya fue retirada.",
      });
    }
    const clinic = await ctx.db.get(fila.clinicId);
    if (!clinic) throw new Error("Clínica no encontrada");
    return { userId: user._id, clinicId: fila.clinicId, ownerUserId: clinic.ownerUserId };
  },
});

export interface MetodoDePagoAportado {
  id: string;
  clinicId: Id<"clinics">;
  clinicaNombre: string;
  tipo: string;
  marca?: string;
  ultimos4?: string;
  caducaMes?: number;
  caducaAnio?: number;
  esActiva: boolean;
  attachedAt: number;
  estadoSuscripcion: string;
  /** Próximo cobro previsto (`currentPeriodEnd ?? trialEnd`), para el copy "antes del …". */
  proximoCobro?: number;
  soyOwner: boolean;
}

async function decorarFilas(
  ctx: QueryCtx | MutationCtx,
  filas: Doc<"clinicPaymentMethods">[],
  userId: Id<"users">,
): Promise<MetodoDePagoAportado[]> {
  const out: MetodoDePagoAportado[] = [];
  const cache = new Map<
    Id<"clinics">,
    { clinic: Doc<"clinics"> | null; billing: Doc<"clinicBilling"> | null }
  >();
  for (const f of filas) {
    let ctxClinica = cache.get(f.clinicId);
    if (!ctxClinica) {
      ctxClinica = {
        clinic: await ctx.db.get(f.clinicId),
        billing: await billingDe(ctx, f.clinicId),
      };
      cache.set(f.clinicId, ctxClinica);
    }
    const { clinic, billing } = ctxClinica;
    if (!clinic) continue;
    const activo = billing ? defaultPaymentMethodDe(billing) : null;
    out.push({
      id: f.stripePaymentMethodId,
      clinicId: f.clinicId,
      clinicaNombre: clinic.nombre,
      tipo: f.tipo,
      marca: f.marca,
      ultimos4: f.ultimos4,
      caducaMes: f.caducaMes,
      caducaAnio: f.caducaAnio,
      esActiva: activo === f.stripePaymentMethodId,
      attachedAt: f.attachedAt,
      estadoSuscripcion: billing?.estadoLocal ?? "none",
      proximoCobro: billing?.currentPeriodEnd ?? billing?.trialEnd,
      soyOwner: clinic.ownerUserId === userId,
    });
  }
  return out.sort((a, b) => b.attachedAt - a.attachedAt);
}

/** Tarjetas vivas aportadas por un usuario (todas sus clínicas o una). */
export async function listarVivasDeUsuario(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  clinicId?: Id<"clinics">,
): Promise<MetodoDePagoAportado[]> {
  const filas = await ctx.db
    .query("clinicPaymentMethods")
    .withIndex("by_aportadaPorUserId", (q) => q.eq("aportadaPorUserId", userId))
    .collect();
  const vivas = filas.filter(
    (f) => f.detachedAt === undefined && (!clinicId || f.clinicId === clinicId),
  );
  return await decorarFilas(ctx, vivas, userId);
}

export const listByUser = internalQuery({
  args: { userId: v.id("users"), clinicId: v.optional(v.id("clinics")) },
  handler: async (ctx, { userId, clinicId }): Promise<MetodoDePagoAportado[]> =>
    await listarVivasDeUsuario(ctx, userId, clinicId),
});

/**
 * Información del método de pago activo de una clínica para la pantalla de
 * suscripción: quién lo aportó y si sigue siendo el owner.
 */
export async function metodoPagoActivoDe(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
  billing: Doc<"clinicBilling"> | null,
  ownerUserId: Id<"users">,
): Promise<{
  marca?: string;
  ultimos4?: string;
  aportadaPorNombre: string;
  aportadaPorEsOwner: boolean;
} | null> {
  if (!billing) return null;
  const activo = defaultPaymentMethodDe(billing);
  if (!activo) return null;
  const fila = await filaPorPm(ctx, activo);
  if (!fila || fila.detachedAt !== undefined || fila.clinicId !== clinicId) {
    return null;
  }
  const user = await ctx.db.get(fila.aportadaPorUserId);
  return {
    marca: fila.marca,
    ultimos4: fila.ultimos4,
    aportadaPorNombre: user ? nombreCompleto(user) : "otra persona",
    aportadaPorEsOwner: fila.aportadaPorUserId === ownerUserId,
  };
}

/**
 * Contexto que necesita la reconciliación de una clínica: owner actual,
 * audits (para `ownerEnFecha`), filas locales vivas y defaults conocidos.
 */
export const getReconcileContext = internalQuery({
  args: { clinicId: v.id("clinics") },
  handler: async (
    ctx,
    { clinicId },
  ): Promise<{
    ownerUserId: Id<"users">;
    ownerEmail: string | null;
    audits: { fromUserId?: Id<"users">; toUserId: Id<"users">; createdAt: number }[];
    vivas: { stripePaymentMethodId: string; aportadaPorUserId: Id<"users"> }[];
    stripeSubscriptionId: string | null;
  } | null> => {
    const clinic = await ctx.db.get(clinicId);
    if (!clinic) return null;
    const owner = await ctx.db.get(clinic.ownerUserId);
    const audits = await ctx.db
      .query("clinicOwnershipAudit")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .collect();
    const filas = await ctx.db
      .query("clinicPaymentMethods")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .collect();
    const billing = await billingDe(ctx, clinicId);
    return {
      ownerUserId: clinic.ownerUserId,
      ownerEmail: owner?.email ?? null,
      audits: audits.map((a) => ({
        fromUserId: a.fromUserId,
        toUserId: a.toUserId,
        createdAt: a.createdAt,
      })),
      vivas: filas
        .filter((f) => f.detachedAt === undefined)
        .map((f) => ({
          stripePaymentMethodId: f.stripePaymentMethodId,
          aportadaPorUserId: f.aportadaPorUserId,
        })),
      stripeSubscriptionId: billing?.stripeSubscriptionId ?? null,
    };
  },
});

/** Email del titular de un PM, para estamparlo en el metadata de Stripe. */
export const getContributorInfo = internalQuery({
  args: { stripePaymentMethodId: v.string() },
  handler: async (
    ctx,
    { stripePaymentMethodId },
  ): Promise<{ clinicId: Id<"clinics">; userId: Id<"users">; email: string } | null> => {
    const fila = await filaPorPm(ctx, stripePaymentMethodId);
    if (!fila) return null;
    const user = await ctx.db.get(fila.aportadaPorUserId);
    if (!user) return null;
    return { clinicId: fila.clinicId, userId: user._id, email: user.email };
  },
});

/**
 * Datos para avisar al owner de que la tarjeta activa se ha retirado. Devuelve
 * `null` si el aviso ya no procede: el pendiente se limpió (llegó otra
 * tarjeta), ya se envió, o quien la retiró es el propio owner.
 */
export const getAvisoRetiradaContext = internalQuery({
  args: { stripePaymentMethodId: v.string() },
  handler: async (
    ctx,
    { stripePaymentMethodId },
  ): Promise<{
    filaId: Id<"clinicPaymentMethods">;
    clinicId: Id<"clinics">;
    clinicaNombre: string;
    owner: { email: string; name: string };
    retiradaPorNombre: string;
    tarjeta: ResumenTarjeta;
    proximoCobro?: number;
  } | null> => {
    const fila = await filaPorPm(ctx, stripePaymentMethodId);
    if (!fila || fila.avisoRetiradaEnviadoAt !== undefined) return null;
    const billing = await billingDe(ctx, fila.clinicId);
    if (!billing || billing.metodoPagoPendienteDesde === undefined) return null;
    const clinic = await ctx.db.get(fila.clinicId);
    if (!clinic) return null;
    const retiradaPor = fila.detachedByUserId ?? fila.aportadaPorUserId;
    if (retiradaPor === clinic.ownerUserId) return null;
    const owner = await ctx.db.get(clinic.ownerUserId);
    if (!owner) return null;
    const retiradaPorUser = await ctx.db.get(retiradaPor);
    return {
      filaId: fila._id,
      clinicId: fila.clinicId,
      clinicaNombre: clinic.nombre,
      owner: { email: owner.email, name: nombreCompleto(owner) },
      retiradaPorNombre: retiradaPorUser
        ? nombreCompleto(retiradaPorUser)
        : "Un antiguo propietario",
      tarjeta: {
        tipo: fila.tipo,
        marca: fila.marca,
        ultimos4: fila.ultimos4,
        caducaMes: fila.caducaMes,
        caducaAnio: fila.caducaAnio,
      },
      proximoCobro: billing.currentPeriodEnd ?? billing.trialEnd,
    };
  },
});

export const markAvisoRetiradaEnviado = internalMutation({
  args: { filaId: v.id("clinicPaymentMethods") },
  handler: async (ctx, { filaId }) => {
    await ctx.db.patch(filaId, { avisoRetiradaEnviadoAt: Date.now() });
  },
});
