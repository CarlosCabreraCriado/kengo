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
  /** Enterprise (>9 fisios) pendiente de acuerdo con ventas; opera con normalidad. */
  | 'enterprise_pending';

/** Variante de pricing: "base" (con cap de pacientes) o "ilimitada". */
export type PlanVariante = 'base' | 'ilimitada';

export interface PlanInfo {
  /** Nombre comercial del plan: "Lonely" | "Smart" | "Medium". */
  nombre: string;
  precioBaseEur: number;
  precioIlimitadoEur: number;
  /** Pacientes vinculados máximos en variante base. */
  limitePacientes: number;
  rangoFisiosMin: number;
  rangoFisiosMax: number;
  /**
   * Compat transitoria: precio que renderizaba el frontend antiguo. El
   * backend lo rellena (base para `planes`, variante actual para `plan`)
   * hasta completar el despliegue del pricing v2.
   */
  precioMensualEur?: number;
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
  /** Variante de pricing activa de la clínica. */
  variante: PlanVariante;
  /** Cap de pacientes vinculados; `null` = sin cap (ilimitada o enterprise). */
  limitePacientes: number | null;
  /** Pacientes vinculados actualmente (puesto `paciente`). */
  pacientesVinculados: number;
  /** Precio mensual del plan actual según la variante activa (0 si sin plan). */
  precioMensualActualEur: number;
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
