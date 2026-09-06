/**
 * Helpers puros para la lógica de billing/suscripciones.
 * No dependen de ctx — solo cálculo sobre el número de fisios y la variante.
 *
 * Tabla de tarifas (ver docs/PLAN_STRIPE_SUSCRIPCIONES.md):
 *   Lonely (1 fisio)    →  89 € / mes · ilimitado 109 € · hasta 150 pacientes
 *   Smart  (2-4 fisios) → 249 € / mes · ilimitado 279 € · hasta 300 pacientes
 *   Medium (5-9 fisios) → 449 € / mes · ilimitado 489 € · hasta 500 pacientes
 *   +9                  → contactar ventas (enterprise)
 *
 * El límite de pacientes solo aplica a la variante "base"; la variante
 * "ilimitada" no tiene cap.
 */

export type PlanVariante = "base" | "ilimitada";

export interface PlanTier {
  nombre: string;
  precioBaseEur: number;
  precioIlimitadoEur: number;
  /** Pacientes vinculados máximos en variante base. */
  limitePacientes: number;
  rangoFisiosMin: number;
  rangoFisiosMax: number;
}

export const PLANES: readonly PlanTier[] = [
  {
    nombre: "Lonely",
    precioBaseEur: 89,
    precioIlimitadoEur: 109,
    limitePacientes: 150,
    rangoFisiosMin: 1,
    rangoFisiosMax: 1,
  },
  {
    nombre: "Smart",
    precioBaseEur: 249,
    precioIlimitadoEur: 279,
    limitePacientes: 300,
    rangoFisiosMin: 2,
    rangoFisiosMax: 4,
  },
  {
    nombre: "Medium",
    precioBaseEur: 449,
    precioIlimitadoEur: 489,
    limitePacientes: 500,
    rangoFisiosMin: 5,
    rangoFisiosMax: 9,
  },
] as const;

export const LIMITE_FISIOS_AUTOSERVICIO = 9;

export function planParaFisios(n: number): PlanTier | null {
  if (n < 1) return null;
  return PLANES.find((p) => n >= p.rangoFisiosMin && n <= p.rangoFisiosMax) ?? null;
}

export function precioParaFisios(n: number, variante: PlanVariante): number {
  const plan = planParaFisios(n);
  if (!plan) return 0;
  return variante === "ilimitada" ? plan.precioIlimitadoEur : plan.precioBaseEur;
}

/**
 * Límite de pacientes vinculados para una clínica.
 * `null` = sin cap (variante ilimitada o fuera de tramos → enterprise).
 */
export function limitePacientesParaFisios(
  n: number,
  variante: PlanVariante,
): number | null {
  if (variante === "ilimitada") return null;
  return planParaFisios(n)?.limitePacientes ?? null;
}

export function requiereContactoVentas(n: number): boolean {
  return n > LIMITE_FISIOS_AUTOSERVICIO;
}

/**
 * ¿Excede la clínica el cap de pacientes de la variante base?
 * Guard compartido por `setPlanVariante` y `createCheckoutSession` para
 * impedir contratar/volver a base con más pacientes vinculados que el cap.
 * `limite === null` (enterprise, fuera de tramo) nunca excede.
 */
export function excedeCapBase(
  nFisios: number,
  nPacientes: number,
): { excede: boolean; limite: number | null } {
  const limite = limitePacientesParaFisios(nFisios, "base");
  return { excede: limite !== null && nPacientes > limite, limite };
}

/**
 * Calcula qué campos del customer de Stripe hay que corregir cuando cambia el
 * propietario de la clínica (`transferOwnership` y variantes de soporte).
 *
 * - `email`: siempre el del nuevo owner — es donde Stripe manda facturas,
 *   recibos y avisos de impago.
 * - `name`: solo si sigue siendo el del owner saliente (o está vacío).
 *   Checkout lo sobrescribe con lo que teclea quien paga (`customer_update:
 *   { name: "auto" }`), que a menudo es la razón social de la clínica y sale
 *   en la factura; pisarlo con el nombre de una persona rompería la factura.
 *   Sin `ownerAnteriorNombre` no podemos distinguir ambos casos y no se toca.
 *
 * Devuelve `null` cuando no hay nada que cambiar.
 */
export function buildCustomerOwnerPatch(
  customer: { email?: string | null; name?: string | null },
  nuevoOwner: { email: string; name: string },
  ownerAnteriorNombre: string | undefined,
): { email?: string; name?: string } | null {
  const patch: { email?: string; name?: string } = {};

  const emailActual = (customer.email ?? "").trim().toLowerCase();
  const emailNuevo = nuevoOwner.email.trim();
  if (emailNuevo !== "" && emailActual !== emailNuevo.toLowerCase()) {
    patch.email = emailNuevo;
  }

  const nombreActual = (customer.name ?? "").trim();
  const nombreNuevo = nuevoOwner.name.trim();
  const eraDelOwnerAnterior =
    ownerAnteriorNombre !== undefined &&
    nombreActual === ownerAnteriorNombre.trim();
  if (
    nombreNuevo !== "" &&
    nombreActual !== nombreNuevo &&
    (nombreActual === "" || eraDelOwnerAnterior)
  ) {
    patch.name = nombreNuevo;
  }

  return Object.keys(patch).length === 0 ? null : patch;
}

/**
 * Owner de la clínica en una fecha pasada, reconstruido desde
 * `clinicOwnershipAudit`. Sirve para atribuir tarjetas ya existentes en Stripe
 * (backfill): quien era owner cuando se adjuntó (`pm.created`) es quien la
 * aportó. Sin audit posterior a la fecha, el owner no ha cambiado desde
 * entonces y vale el actual. Si el audit que cierra el tramo no trae
 * `fromUserId` (filas antiguas), se cae al `toUserId` del audit anterior y,
 * en último término, al owner actual.
 */
export function ownerEnFecha<T extends string>(
  audits: ReadonlyArray<{ fromUserId?: T; toUserId: T; createdAt: number }>,
  ownerActual: T,
  fechaMs: number,
): T {
  const ordenados = [...audits].sort((a, b) => a.createdAt - b.createdAt);
  for (let i = 0; i < ordenados.length; i++) {
    const audit = ordenados[i];
    if (audit.createdAt > fechaMs) {
      if (audit.fromUserId !== undefined) return audit.fromUserId;
      const anterior = ordenados[i - 1];
      return anterior ? anterior.toUserId : ownerActual;
    }
  }
  return ownerActual;
}

/**
 * Método de pago que cobra: el de la subscription manda sobre el del customer.
 * `null` cuando no hay ninguno (la próxima factura fallará).
 */
export function defaultPaymentMethodDe(billing: {
  stripeSubscriptionDefaultPaymentMethodId?: string;
  stripeCustomerDefaultPaymentMethodId?: string;
}): string | null {
  return (
    billing.stripeSubscriptionDefaultPaymentMethodId ??
    billing.stripeCustomerDefaultPaymentMethodId ??
    null
  );
}

/** Id de un campo de Stripe que puede venir expandido o como string. */
export function idDeRef(
  ref: string | { id: string } | null | undefined,
): string | undefined {
  if (!ref) return undefined;
  return typeof ref === "string" ? ref : ref.id;
}

export interface ResumenTarjeta {
  tipo: string;
  marca?: string;
  ultimos4?: string;
  caducaMes?: number;
  caducaAnio?: number;
}

/**
 * Campos mostrables de un PaymentMethod de Stripe. Cubre `card` y
 * `sepa_debit`; para el resto solo queda el tipo.
 */
export function resumenTarjeta(pm: {
  type: string;
  card?: {
    brand?: string;
    last4?: string;
    exp_month?: number;
    exp_year?: number;
  } | null;
  sepa_debit?: { last4?: string | null } | null;
}): ResumenTarjeta {
  if (pm.card) {
    return {
      tipo: pm.type,
      marca: pm.card.brand,
      ultimos4: pm.card.last4,
      caducaMes: pm.card.exp_month,
      caducaAnio: pm.card.exp_year,
    };
  }
  if (pm.sepa_debit?.last4) {
    return { tipo: pm.type, marca: "SEPA", ultimos4: pm.sepa_debit.last4 };
  }
  return { tipo: pm.type };
}

/** Estados en los que no hay cobros que perder si desaparece la tarjeta. */
const ESTADOS_SIN_COBRO = new Set([
  "canceled",
  "none",
  "incomplete",
  "enterprise_pending",
]);

/**
 * Al retirarse un PM: ¿hay que sellar `metodoPagoPendienteDesde`? Solo si era
 * el que cobraba y la suscripción sigue viva (trialing/active/past_due/unpaid).
 */
export function debeMarcarPendiente(args: {
  pmRetirado: string;
  defaultActual: string | null;
  estadoLocal: string | undefined;
}): boolean {
  if (args.defaultActual !== args.pmRetirado) return false;
  return !ESTADOS_SIN_COBRO.has(args.estadoLocal ?? "none");
}
