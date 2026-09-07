/**
 * Helpers puros para el régimen fiscal de la facturación.
 *
 * Kengo tiene residencia fiscal en Canarias, fuera del territorio de
 * aplicación del IVA. Para un servicio B2B eso da solo dos resultados:
 *
 *   - Cliente en Canarias        → se repercute IGIC (tipo general, 7 %).
 *   - Cliente en cualquier otro
 *     sitio (Península, Baleares,
 *     Ceuta, Melilla, UE, no-UE)  → factura sin cuota con la mención de
 *                                    "inversión del sujeto pasivo".
 *
 * Stripe Tax no calcula impuesto para Canarias, Ceuta y Melilla aunque haya
 * registro español (docs.stripe.com/tax/zero-tax#excluded-territories), así
 * que el impuesto se aplica con un Tax Rate manual (`STRIPE_TAX_RATE_ID_IGIC`)
 * y el resto de clientes se marcan `tax_exempt: "reverse"`, que hace que
 * Stripe imprima la leyenda en factura y PDF.
 *
 * La decisión se toma SIEMPRE sobre `customer.address` de Stripe (la
 * dirección fiscal que recoge Checkout y que el cliente puede editar en el
 * Customer Portal), nunca sobre la ficha de la clínica en Convex.
 *
 * Sin dependencias de Convex ni de Stripe: se testea con
 * `npx tsx convex/billing/_taxHelpers.test.ts`.
 */

export type RegimenFiscal = "igic" | "inversion" | "desconocido";

/** Tipo general del IGIC. Solo informativo: el porcentaje real vive en el Tax Rate de Stripe. */
export const IGIC_PORCENTAJE = 7;

/**
 * Pie de factura para clientes fuera de Canarias. Stripe ya imprime
 * "Inversión del sujeto pasivo" cuando `tax_exempt = "reverse"`; este texto
 * añade la base legal.
 *
 * TODO(fiscal): texto pendiente de validación por la asesoría. Si cambia, el
 * backfill `backfillRegimenFiscal` lo propaga: `buildCustomerRegimenPatch`
 * solo sustituye el footer cuando es exactamente uno de los nuestros.
 */
export const FOOTER_INVERSION_SUJETO_PASIVO =
  "Inversión del sujeto pasivo: operación localizada en la sede del destinatario y no sujeta a IGIC. " +
  "El destinatario es el sujeto pasivo del impuesto (art. 84.Uno.2.º Ley 37/1992 del IVA; art. 196 Directiva 2006/112/CE).";

/**
 * Versiones anteriores del footer que también son nuestras y por tanto se
 * pueden sustituir o retirar sin pisar un texto puesto a mano en el Dashboard.
 */
const FOOTERS_PROPIOS: readonly string[] = [FOOTER_INVERSION_SUJETO_PASIVO];

/** Subconjunto de `Stripe.Address` que necesita la decisión. */
export interface DireccionFiscal {
  country?: string | null;
  postal_code?: string | null;
  state?: string | null;
}

const CP_CANARIAS = /^(35|38)\d{3}$/;

/**
 * Valores de `state` que identifican Canarias cuando no hay código postal.
 * Checkout deja `state` libre para España, así que llegan tanto códigos ISO
 * ("CN") como nombres de comunidad, provincia o isla.
 */
const STATES_CANARIAS: readonly string[] = [
  "cn",
  "es-cn",
  "canarias",
  "islas canarias",
  "canary islands",
  "las palmas",
  "santa cruz de tenerife",
  "tenerife",
  "gran canaria",
  "lanzarote",
  "fuerteventura",
  "la palma",
  "la gomera",
  "el hierro",
];

function normalizar(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** CP español de 5 dígitos, admitiendo espacios y el prefijo "ES-". */
function normalizarCodigoPostal(cp: string | null | undefined): string | null {
  const limpio = (cp ?? "").replace(/\s+/g, "").replace(/^ES-?/i, "");
  return /^\d{5}$/.test(limpio) ? limpio : null;
}

/**
 * Régimen fiscal aplicable a una dirección de facturación.
 *
 *   - Sin país                     → `desconocido` (Checkout aún no recogió
 *                                    la dirección; no facturar con esto).
 *   - País distinto de España      → `inversion` (UE y no-UE).
 *   - España con CP 35xxx / 38xxx  → `igic`.
 *   - España con otro CP           → `inversion` (incluye Ceuta 51 y Melilla 52).
 *   - España sin CP pero con state → `igic` si es canario, si no `inversion`.
 *   - España sin CP ni state       → `desconocido`.
 *
 * "IC" es el código ISO 3166-1 reservado para Canarias; algunos formularios
 * lo usan en vez de "ES", así que se trata como Canarias.
 */
export function resolveRegimenFiscal(
  direccion: DireccionFiscal | null | undefined,
): RegimenFiscal {
  const country = (direccion?.country ?? "").trim().toUpperCase();
  if (!country) return "desconocido";
  if (country === "IC") return "igic";
  if (country !== "ES") return "inversion";

  const cp = normalizarCodigoPostal(direccion?.postal_code);
  if (cp) return CP_CANARIAS.test(cp) ? "igic" : "inversion";

  const state = normalizar(direccion?.state);
  if (!state) return "desconocido";
  return STATES_CANARIAS.includes(state) ? "igic" : "inversion";
}

/** Estado fiscal que debe tener el customer de Stripe para un régimen. */
export function customerTargetFor(regimen: RegimenFiscal): {
  tax_exempt: "none" | "reverse";
  footer: string | null;
} {
  return regimen === "inversion"
    ? { tax_exempt: "reverse", footer: FOOTER_INVERSION_SUJETO_PASIVO }
    : { tax_exempt: "none", footer: null };
}

/** Tax rates que debe llevar la suscripción para un régimen. */
export function subscriptionTaxRatesFor(
  regimen: RegimenFiscal,
  igicTaxRateId: string,
): string[] {
  return regimen === "igic" ? [igicTaxRateId] : [];
}

/** Lo que leemos del customer de Stripe para decidir el patch. */
export interface CustomerFiscalSnapshot {
  tax_exempt?: "none" | "exempt" | "reverse" | null;
  invoice_settings?: { footer?: string | null } | null;
}

/** Patch mínimo compatible con `Stripe.CustomerUpdateParams`. */
export interface CustomerRegimenPatch {
  tax_exempt?: "none" | "reverse";
  /** `footer: ""` vacía el pie en Stripe. */
  invoice_settings?: { footer: string };
}

/**
 * Diff puro entre el estado actual del customer y el que exige el régimen.
 * Devuelve `null` si no hay nada que escribir (idempotencia: el webhook
 * `customer.updated` que dispara nuestro propio update vuelve aquí y no debe
 * volver a escribir).
 *
 * El footer solo se toca cuando el actual está vacío o es uno de los
 * nuestros: un pie puesto a mano en el Dashboard se respeta.
 */
export function buildCustomerRegimenPatch(
  customer: CustomerFiscalSnapshot,
  regimen: RegimenFiscal,
): CustomerRegimenPatch | null {
  const target = customerTargetFor(regimen);
  const patch: CustomerRegimenPatch = {};

  const taxExemptActual = customer.tax_exempt ?? "none";
  if (taxExemptActual !== target.tax_exempt) {
    patch.tax_exempt = target.tax_exempt;
  }

  const footerActual = customer.invoice_settings?.footer ?? "";
  const footerEsNuestro = FOOTERS_PROPIOS.includes(footerActual);
  if (target.footer) {
    if (footerActual !== target.footer && (footerActual === "" || footerEsNuestro)) {
      patch.invoice_settings = { footer: target.footer };
    }
  } else if (footerEsNuestro) {
    patch.invoice_settings = { footer: "" };
  }

  return Object.keys(patch).length === 0 ? null : patch;
}

/** Lo que leemos de la suscripción de Stripe para decidir el patch. */
export interface SubscriptionFiscalSnapshot {
  default_tax_rates?: { id: string }[] | null;
  automatic_tax?: { enabled: boolean } | null;
}

/** Patch mínimo compatible con `Stripe.SubscriptionUpdateParams`. */
export interface SubscriptionRegimenPatch {
  /** `""` vacía la lista (`Emptyable<string[]>` en el SDK). */
  default_tax_rates?: string[] | "";
  automatic_tax?: { enabled: false };
}

/**
 * Diff puro para la suscripción: alinea `default_tax_rates` con el régimen y
 * apaga `automatic_tax` (Stripe Tax) si seguía activo de la etapa anterior.
 * `null` si ya está todo en su sitio.
 */
export function buildSubscriptionRegimenPatch(
  sub: SubscriptionFiscalSnapshot,
  regimen: RegimenFiscal,
  igicTaxRateId: string,
): SubscriptionRegimenPatch | null {
  const patch: SubscriptionRegimenPatch = {};

  const deseados = subscriptionTaxRatesFor(regimen, igicTaxRateId);
  const actuales = (sub.default_tax_rates ?? []).map((r) => r.id);
  const iguales =
    deseados.length === actuales.length &&
    deseados.every((id) => actuales.includes(id));
  if (!iguales) {
    patch.default_tax_rates = deseados.length > 0 ? deseados : "";
  }

  if (sub.automatic_tax?.enabled) {
    patch.automatic_tax = { enabled: false };
  }

  return Object.keys(patch).length === 0 ? null : patch;
}

/**
 * Estados de suscripción sobre los que Stripe admite `subscriptions.update`.
 * Una `canceled` o `incomplete_expired` es inmutable.
 */
export function esSubscriptionActualizable(status: string): boolean {
  return (
    status === "trialing" ||
    status === "active" ||
    status === "past_due" ||
    status === "unpaid" ||
    status === "incomplete"
  );
}
