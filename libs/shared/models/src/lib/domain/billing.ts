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

/**
 * Régimen fiscal aplicado a las facturas de la clínica, decidido sobre la
 * dirección de facturación recogida por Stripe Checkout:
 *  - `igic`: cliente en Canarias → IGIC 7 % en factura.
 *  - `inversion`: resto de España, UE y no-UE → sin cuota, "inversión del
 *    sujeto pasivo".
 *  - `desconocido`: todavía no hay dirección fiscal (trial sin Checkout).
 */
export type RegimenFiscal = 'igic' | 'inversion' | 'desconocido';

export interface PlanInfo {
  /** Nombre comercial del plan: "Lonely" | "Smart" | "Medium". */
  nombre: string;
  precioBaseEur: number;
  precioIlimitadoEur: number;
  /** Pacientes vinculados máximos en variante base. */
  limitePacientes: number;
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
  /** Variante de pricing activa de la clínica. */
  variante: PlanVariante;
  /** Cap de pacientes vinculados; `null` = sin cap (ilimitada o enterprise). */
  limitePacientes: number | null;
  /** Pacientes vinculados actualmente (puesto `paciente`). */
  pacientesVinculados: number;
  /** Precio mensual del plan actual según la variante activa (0 si sin plan). */
  precioMensualActualEur: number;
  /**
   * Techo de asientos facturables (fisio + admin) de la clínica. En
   * autoservicio son los 9 del plan; con contrato a medida, las plazas que
   * ventas pactó y fijó como `quantity` en Stripe.
   */
  limiteFisios: number;
  /**
   * `true` si la suscripción usa un price negociado fuera de los planes de
   * autoservicio. Esas clínicas no contratan ni cambian de variante desde la
   * app: su plan se gestiona en Stripe.
   */
  esAMedida: boolean;
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
  /**
   * Titularidad del método de pago (campos aditivos, opcionales para que los
   * clientes anteriores sigan funcionando). `metodoPagoPendienteDesde` se
   * sella cuando el titular retira la tarjeta que cobraba y la suscripción
   * sigue viva: el owner debe añadir otra antes del próximo cobro.
   */
  metodoPagoPendienteDesde?: number;
  /** Quién retiró la tarjeta activa (si se conoce). */
  metodoPagoRetiradoPorNombre?: string;
  /** Tarjeta que cobra hoy y quién la aportó; `null` si no hay ninguna viva. */
  metodoPagoActivo?: {
    marca?: string;
    ultimos4?: string;
    aportadaPorNombre: string;
    aportadaPorEsOwner: boolean;
  } | null;
  /**
   * Régimen fiscal aplicado en Stripe. Opcional para que los clientes nativos
   * anteriores sigan funcionando; ausente equivale a `desconocido`.
   */
  regimenFiscal?: RegimenFiscal;
}

/**
 * Tarjeta aportada por el usuario a una clínica. Espejo de
 * `api.billing.queries.listMisMetodosDePago`.
 */
export interface MetodoDePagoAportado {
  /** `stripePaymentMethodId`. */
  id: string;
  clinicId: string;
  clinicaNombre: string;
  tipo: string;
  marca?: string;
  ultimos4?: string;
  caducaMes?: number;
  caducaAnio?: number;
  /** `true` si es la que cobra la suscripción hoy. */
  esActiva: boolean;
  attachedAt: number;
  estadoSuscripcion: string;
  /** Próximo cobro previsto (`currentPeriodEnd ?? trialEnd`). */
  proximoCobro?: number;
  /** `true` si el usuario sigue siendo el propietario de esa clínica. */
  soyOwner: boolean;
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

/**
 * Vista previa de la próxima factura, leída de Stripe en vivo. Espejo de
 * `api.billing.actions.getProximaFacturaForClinic`. Es la fuente del importe
 * de un contrato a medida (Convex no persiste precios). Importes en céntimos.
 */
export interface ProximaFactura {
  /** Neto tras descuentos, antes de impuestos. */
  subtotal: number;
  /** Cuota de impuesto (0 con inversión del sujeto pasivo). */
  impuestos: number;
  total: number;
  moneda: string;
  /** Timestamp ms del cobro previsto; `null` si Stripe no lo informa. */
  fecha: number | null;
}
