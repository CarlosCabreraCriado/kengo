/**
 * Tipos de dominio para suscripciones / billing.
 * Espejo del shape devuelto por `api.billing.queries.getMyClinicSubscription`.
 */

export type SubscriptionEstado =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid'
  | 'none'
  /** Enterprise (>10 fisios) pendiente de acuerdo con ventas; opera con normalidad. */
  | 'enterprise_pending';

export interface PlanInfo {
  nombre: string;
  precioMensualEur: number;
  rangoFisiosMin: number;
  rangoFisiosMax: number;
}

export interface ClinicSubscription {
  clinicId: string;
  /** Nombre legible de la clínica activa, para mostrarlo en headers/banners. */
  clinicaNombre: string;
  estado: SubscriptionEstado;
  trialEnd?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd: boolean;
  graceUntil?: number;
  fisiosActuales: number;
  cantidadFacturada?: number;
  plan: PlanInfo | null;
  planes: PlanInfo[];
  requiereContactoVentas: boolean;
  /**
   * `userId` del propietario único de la clínica (Bloque J). Solo este
   * usuario puede gestionar la suscripción Stripe. Garantizado por el
   * schema: toda clínica tiene exactamente un owner.
   */
  ownerUserId: string;
  /** Nombre legible del propietario (para mensajes "El responsable es X"). */
  ownerNombre: string | null;
  /** `true` si el usuario autenticado es el propietario. */
  esOwner: boolean;
  /**
   * Veredicto de bloqueo calculado en el servidor, espejo del gating del
   * backend (`billingPermiteOperar`): `true` cuando la clínica NO puede operar
   * (unpaid, canceled, incomplete, o past_due con la gracia agotada). El
   * frontend lo consume directamente en vez de rederivarlo, evitando la
   * ambigüedad del estado `none` (sin fila = permisivo).
   */
  bloqueada: boolean;
}

export const PLANES: PlanInfo[] = [
  { nombre: '1 Fisio', precioMensualEur: 65, rangoFisiosMin: 1, rangoFisiosMax: 1 },
  { nombre: '2-4 Fisios', precioMensualEur: 170, rangoFisiosMin: 2, rangoFisiosMax: 4 },
  { nombre: '5-10 Fisios', precioMensualEur: 280, rangoFisiosMin: 5, rangoFisiosMax: 10 },
];

export const LIMITE_FISIOS_AUTOSERVICIO = 10;

export function planParaFisios(n: number): PlanInfo | null {
  return PLANES.find((p) => n >= p.rangoFisiosMin && n <= p.rangoFisiosMax) ?? null;
}

export function requiereContactoVentas(n: number): boolean {
  return n > LIMITE_FISIOS_AUTOSERVICIO;
}

export type InvoiceEstado =
  | 'paid'
  | 'open'
  | 'uncollectible'
  | 'void'
  | 'draft';

export interface InvoiceItem {
  id: string;
  /** Número de factura emitido por Stripe (puede ser null en borradores). */
  numero: string | null;
  /** Timestamp ms de creación. */
  creadoEn: number;
  /** Importe total en céntimos (la moneda viene en `moneda`). */
  importeTotal: number;
  moneda: string;
  estado: InvoiceEstado;
  /** URL del PDF descargable (puede ser null en borradores o si Stripe aún no la generó). */
  pdfUrl: string | null;
  /** URL hosted de Stripe para ver/pagar la factura. */
  hostedUrl: string | null;
}

export interface InvoicesResult {
  invoices: InvoiceItem[];
  error?: string;
}
