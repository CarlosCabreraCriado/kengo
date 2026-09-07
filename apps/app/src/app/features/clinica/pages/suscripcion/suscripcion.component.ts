import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { SubscriptionService } from '../../../../core/billing/subscription.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { DialogService } from '../../../../shared/services/dialog/dialog.service';
import { ToastService } from '../../../../shared/services/toast/toast.service';
import { ContactarVentasDialogComponent } from '../../components/contactar-ventas-dialog/contactar-ventas-dialog.component';
import { PricingCardsComponent } from '../../components/pricing-cards/pricing-cards.component';
import {
  Ui2BackButtonComponent,
  Ui2BigTitleComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2ListRowComponent,
  Ui2PillComponent,
  Ui2ProgressBarComponent,
  Ui2SectionLabelComponent,
  Ui2SegmentedComponent,
  Ui2SpinnerComponent,
  Ui2PillVariant,
  type Ui2SegmentedOption,
} from '../../../../shared/ui-v2';
import { api } from '../../../../../../../../convex/_generated/api';

import type {
  InvoiceEstado,
  InvoiceItem,
  PlanInfo,
  PlanVariante,
  ProximaFactura,
  RegimenFiscal,
  SubscriptionEstado,
} from '@kengo/shared-models';

interface EstadoVm {
  texto: string;
  variant: Ui2PillVariant;
  icon: string;
}

interface RegimenFiscalVm {
  texto: string;
  detalle: string;
  icon: string;
}

/**
 * Régimen fiscal que Stripe aplica en factura según la dirección fiscal de la
 * clínica (Kengo factura desde Canarias). Los precios de la app son netos.
 */
const REGIMEN_FISCAL_VM: Record<RegimenFiscal, RegimenFiscalVm> = {
  igic: {
    texto: 'IGIC 7 %',
    detalle: 'Clínica en Canarias: el impuesto se suma al precio del plan.',
    icon: 'receipt_long',
  },
  inversion: {
    texto: 'Inversión del sujeto pasivo',
    detalle: 'Factura sin cuota de impuesto; el IVA lo autoliquida tu clínica.',
    icon: 'receipt_long',
  },
  desconocido: {
    texto: 'Pendiente de dirección fiscal',
    detalle:
      'Se determina al añadir el método de pago. Puedes corregir la dirección desde el portal de pago.',
    icon: 'pin_drop',
  },
};

interface InvoiceEstadoVm {
  texto: string;
  variant: Ui2PillVariant;
}

const ESTADO_VM: Record<SubscriptionEstado, EstadoVm> = {
  trialing: { texto: 'Trial activo', variant: 'soft', icon: 'schedule' },
  active: { texto: 'Activa', variant: 'success', icon: 'check_circle' },
  past_due: { texto: 'Pago pendiente', variant: 'warning', icon: 'error' },
  canceled: { texto: 'Cancelada', variant: 'neutral', icon: 'block' },
  incomplete: { texto: 'Incompleta', variant: 'warning', icon: 'hourglass_empty' },
  unpaid: { texto: 'Suspendida', variant: 'danger', icon: 'lock' },
  none: { texto: 'Sin suscripción', variant: 'neutral', icon: 'info' },
  enterprise_pending: {
    texto: 'Plan a medida',
    variant: 'soft',
    icon: 'apartment',
  },
};

const INVOICE_ESTADO_VM: Record<InvoiceEstado, InvoiceEstadoVm> = {
  paid: { texto: 'Pagada', variant: 'success' },
  open: { texto: 'Pendiente', variant: 'warning' },
  uncollectible: { texto: 'Fallida', variant: 'danger' },
  void: { texto: 'Anulada', variant: 'neutral' },
  draft: { texto: 'Borrador', variant: 'neutral' },
};

@Component({
  standalone: true,
  selector: 'app-suscripcion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    UpperCasePipe,
    PricingCardsComponent,
    Ui2BackButtonComponent,
    Ui2BigTitleComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2ListRowComponent,
    Ui2PillComponent,
    Ui2ProgressBarComponent,
    Ui2SectionLabelComponent,
    Ui2SegmentedComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './suscripcion.component.html',
  styleUrl: './suscripcion.component.css',
  host: { class: 'block w-full' },
})
export class SuscripcionComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly convex = inject(ConvexService);
  private readonly dialogService = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);
  protected readonly subs = inject(SubscriptionService);

  protected readonly suscripcion = this.subs.suscripcion;
  protected readonly loading = this.subs.loading;
  protected readonly error = this.subs.error;
  /** Acción de billing en vuelo — bloquea los CTAs para evitar doble click (H-10). */
  protected readonly accionEnCurso = this.subs.accionEnCurso;

  protected readonly clinicId = computed<string | null>(() =>
    this.subs.esAdminEnClinicaActiva() ? this.subs.clinicIdActiva() : null,
  );

  protected readonly estadoVm = computed<EstadoVm>(() => {
    const estado = this.suscripcion()?.estado ?? 'none';
    return ESTADO_VM[estado];
  });

  protected readonly diasRestantesTrial = this.subs.diasRestantesTrial;
  protected readonly cancelaAlFinDelPeriodo = this.subs.cancelaAlFinDelPeriodo;
  protected readonly bloqueada = this.subs.bloqueada;

  /**
   * Solo el propietario puede ejecutar acciones de billing. Para los
   * demás admins la pantalla queda en modo lectura: ven el estado, las
   * facturas históricas y el plan, pero todos los CTAs (Activar, Cancelar,
   * Gestionar pago, Reactivar) están ocultos. En su lugar ven una nota
   * indicando quién es el responsable. (Bloque H / decisión #18.)
   */
  protected readonly esOwner = this.subs.esOwnerDeClinicaActiva;
  protected readonly ownerNombre = this.subs.ownerNombre;
  protected readonly clinicaNombre = this.subs.clinicaNombre;

  /**
   * En builds nativos las decisiones de compra (checkout, portal, reactivar,
   * cambio de variante) no se ofrecen — políticas de pagos de las stores.
   * La pantalla queda en modo consulta con una nota de gestión desde la web.
   */
  protected readonly pagosSoloWeb = this.subs.pagosSoloWeb;

  /**
   * Titularidad del método de pago: la tarjeta activa la aportó otra persona
   * (owner anterior) o se retiró y hay que añadir otra antes del próximo cobro.
   */
  protected readonly metodoPagoPendiente = this.subs.metodoPagoPendiente;
  protected readonly metodoPagoPendienteDesde = this.subs.metodoPagoPendienteDesde;
  protected readonly metodoPagoRetiradoPorNombre = this.subs.metodoPagoRetiradoPorNombre;
  protected readonly metodoPagoActivo = this.subs.metodoPagoActivo;
  protected readonly proximoCobro = computed(
    () => this.suscripcion()?.currentPeriodEnd ?? this.suscripcion()?.trialEnd,
  );

  /**
   * Régimen fiscal aplicado en Stripe. Sin fila de billing (`none`) no hay
   * nada que mostrar; un cliente antiguo sin el campo equivale a
   * `desconocido`.
   */
  protected readonly regimenFiscalVm = computed<RegimenFiscalVm | null>(() => {
    const sub = this.suscripcion();
    if (!sub || sub.estado === 'none') return null;
    return REGIMEN_FISCAL_VM[sub.regimenFiscal ?? 'desconocido'];
  });

  protected readonly planActual = computed<PlanInfo | null>(
    () => this.suscripcion()?.plan ?? null,
  );

  protected readonly planes = computed<PlanInfo[]>(
    () => this.suscripcion()?.planes ?? [],
  );

  protected readonly fisiosActuales = computed(
    () => this.suscripcion()?.fisiosActuales ?? 0,
  );

  protected readonly requiereContactoVentas = computed(
    () => this.suscripcion()?.requiereContactoVentas === true,
  );

  /**
   * Contrato a medida: el plan lo gestiona ventas en Stripe, así que la página
   * no ofrece Checkout, cambio de variante ni upsell de tramo.
   */
  protected readonly esAMedida = computed(
    () => this.suscripcion()?.esAMedida === true,
  );

  /** Techo de asientos: plazas contratadas o tope del plan autoservicio. */
  protected readonly limiteFisios = computed(
    () => this.suscripcion()?.limiteFisios ?? 0,
  );

  /**
   * `true` cuando la clínica gestiona su plan desde la app. Es falso tanto si
   * ya tiene contrato a medida como si superó el autoservicio y espera a
   * ventas: en ambos casos el plan se toca fuera de aquí.
   */
  protected readonly gestionAutoservicio = computed(
    () => !this.requiereContactoVentas() && !this.esAMedida(),
  );

  protected readonly progresoFisios = computed<number>(() => {
    const limite = this.limiteFisios();
    if (limite <= 0) return 0;
    return Math.min(100, (this.fisiosActuales() / limite) * 100);
  });

  // ─── Variante de pricing (base ↔ ilimitada) ───

  protected readonly variante = this.subs.variante;
  protected readonly esIlimitada = this.subs.esIlimitada;
  protected readonly limitePacientes = this.subs.limitePacientes;
  protected readonly pacientesVinculados = this.subs.pacientesVinculados;
  protected readonly capPacientesAlcanzado = this.subs.capPacientesAlcanzado;

  /**
   * Estados sin sub viva en los que el CTA principal acaba creando una sub
   * nueva (Checkout en modo setup + `finalizeCheckout` en servidor). Solo aquí
   * tiene sentido elegir variante antes del checkout; con sub viva el cambio
   * va por la sección "Pacientes ilimitados" (`setPlanVariante`, con
   * prorrateo).
   */
  protected readonly preCheckout = computed<boolean>(() => {
    const estado = this.suscripcion()?.estado ?? 'none';
    return (
      estado === 'none' || estado === 'canceled' || estado === 'incomplete'
    );
  });

  /**
   * Variante elegida en el segmented pre-checkout. `null` = seguir la
   * persistida de la clínica (evita un effect de inicialización). Estado
   * efímero de UI: no se persiste hasta que el owner lanza el checkout.
   */
  protected readonly varianteSeleccionada = signal<PlanVariante | null>(null);

  /** Variante que reflejan las pricing-cards (y que irá al checkout). */
  protected readonly varianteCards = computed<PlanVariante>(() =>
    this.preCheckout()
      ? (this.varianteSeleccionada() ?? this.variante())
      : this.variante(),
  );

  protected readonly segmentedOptions = computed<Ui2SegmentedOption[]>(() => {
    const limite = this.planActual()?.limitePacientes;
    return [
      { id: 'base', label: limite ? `Hasta ${limite} pacientes` : 'Plan base' },
      { id: 'ilimitada', label: 'Pacientes ilimitados' },
    ];
  });

  protected seleccionarVariante(id: string): void {
    const variante = id as PlanVariante;
    if (variante === 'base') {
      const limite = this.planActual()?.limitePacientes ?? Infinity;
      if (this.pacientesVinculados() > limite) {
        this.toast.error(
          `Tienes ${this.pacientesVinculados()} pacientes vinculados: el plan base admite ${limite}. Necesitas la variante ilimitada.`,
        );
        return;
      }
    }
    this.varianteSeleccionada.set(variante);
  }

  /** Precio mensual del plan actual según la variante activa. */
  protected readonly precioActualEur = computed<number>(
    () => this.suscripcion()?.precioMensualActualEur ?? 0,
  );

  /** Precio del plan actual en la OTRA variante (para el diálogo de cambio). */
  protected readonly precioOtraVarianteEur = computed<number>(() => {
    const plan = this.planActual();
    if (!plan) return 0;
    return this.esIlimitada() ? plan.precioBaseEur : plan.precioIlimitadoEur;
  });

  protected readonly progresoPacientes = computed<number>(() => {
    const limite = this.limitePacientes();
    if (limite === null || limite === 0) return 0;
    return Math.min(100, (this.pacientesVinculados() / limite) * 100);
  });

  /** Precio de un plan según la variante activa (para hints de upsell). */
  protected precioDe(plan: PlanInfo | null): number {
    if (!plan) return 0;
    return this.esIlimitada() ? plan.precioIlimitadoEur : plan.precioBaseEur;
  }

  protected readonly tierLleno = computed<boolean>(() => {
    const limite = this.limiteFisios();
    if (limite <= 0) return false;
    return this.fisiosActuales() >= limite;
  });

  protected readonly siguientePlan = computed<PlanInfo | null>(() => {
    // En un contrato a medida no hay "tramo siguiente" al que subir.
    if (this.esAMedida()) return null;
    const plan = this.planActual();
    if (!plan) return null;
    const todos = this.planes();
    const idx = todos.findIndex((p) => p.nombre === plan.nombre);
    if (idx < 0 || idx === todos.length - 1) return null;
    return todos[idx + 1];
  });

  protected readonly facturas = signal<InvoiceItem[]>([]);
  protected readonly facturasError = signal<string | null>(null);
  protected readonly facturasCargando = signal<boolean>(false);

  /**
   * Próxima factura leída de Stripe (solo owner con contrato a medida): es la
   * única fuente del importe de un plan negociado, que la query no conoce.
   * `null` mientras carga o si Stripe no puede previsualizarla — en ese caso
   * la pantalla no pinta importe alguno en lugar de inventar un 0.
   */
  protected readonly proximaFactura = signal<ProximaFactura | null>(null);

  /**
   * Resultado del retorno de Checkout (web). Se lee UNA vez del query param y
   * se limpia la URL (M-9), para que la tarjeta de éxito/cancelación no
   * reaparezca al recargar o volver con el back, y para no dejar `?ok=1` en
   * marcadores. `null` cuando no venimos de Stripe.
   */
  protected readonly retornoStripe = signal<'ok' | 'cancel' | null>(null);

  /**
   * Llegada redirigida desde `ActiveSubscriptionGuard` al intentar entrar a
   * una ruta protegida con la suscripción suspendida (`unpaid` o gracia
   * agotada). En ese caso destacamos el bloqueo arriba de la página.
   */
  protected readonly llegadaPorBloqueo = toSignal(
    this.route.queryParamMap.pipe(map((qp) => qp.get('bloqueada') === '1')),
    { initialValue: false },
  );

  constructor() {
    // Retorno de Checkout web: leer `ok`/`cancel` una sola vez y limpiar la URL
    // (M-9), preservando el resto de params (p.ej. `bloqueada`).
    const qp = this.route.snapshot.queryParamMap;
    if (qp.has('ok')) this.retornoStripe.set('ok');
    else if (qp.has('cancel')) this.retornoStripe.set('cancel');
    if (this.retornoStripe()) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { ok: null, cancel: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    effect(() => {
      const id = this.clinicId();
      const sub = this.suscripcion();
      // Solo el owner puede listar facturas (la action es owner-only). Antes se
      // llamaba para cualquier admin y fallaba con un error permanente bajo un
      // texto que prometía las facturas (H-9).
      if (!id || !sub || sub.estado === 'none' || !sub.esOwner) {
        this.facturas.set([]);
        this.facturasError.set(null);
        return;
      }
      void this.cargarFacturas(id);
    });

    effect(() => {
      const id = this.clinicId();
      const sub = this.suscripcion();
      const conCobro =
        sub?.estado === 'trialing' ||
        sub?.estado === 'active' ||
        sub?.estado === 'past_due';
      if (!id || !sub || !sub.esOwner || !sub.esAMedida || !conCobro) {
        this.proximaFactura.set(null);
        return;
      }
      void this.cargarProximaFactura(id);
    });
  }

  private async cargarProximaFactura(clinicId: string): Promise<void> {
    try {
      const result = await this.convex.action(
        api.billing.actions.getProximaFacturaForClinic,
        { clinicId: clinicId as never },
      );
      this.proximaFactura.set(result as ProximaFactura | null);
    } catch (err) {
      this.logger.error('[SuscripcionComponent] cargarProximaFactura', err);
      this.proximaFactura.set(null);
    }
  }

  private async cargarFacturas(clinicId: string): Promise<void> {
    this.facturasCargando.set(true);
    try {
      const result = await this.convex.action(
        api.billing.actions.listInvoicesForClinic,
        { clinicId: clinicId as never, limit: 6 },
      );
      this.facturas.set(result.invoices as InvoiceItem[]);
      this.facturasError.set(result.error ?? null);
    } catch (err) {
      this.logger.error('[SuscripcionComponent] cargarFacturas', err);
      this.facturasError.set('No se pudieron cargar las facturas');
      this.facturas.set([]);
    } finally {
      this.facturasCargando.set(false);
    }
  }

  /**
   * Portal de Stripe directo (histórico de facturas, tarjeta). No pasa por
   * `accionPrincipal`, que en trial abre Checkout en vez del Portal.
   */
  protected async abrirPortal(): Promise<void> {
    const id = this.clinicId();
    if (!id) return;
    await this.subs.abrirPortal(id);
  }

  protected estadoFactura(estado: InvoiceEstado): InvoiceEstadoVm {
    return INVOICE_ESTADO_VM[estado] ?? INVOICE_ESTADO_VM.draft;
  }

  protected async accionPrincipal(): Promise<void> {
    const id = this.clinicId();
    if (!id) return;
    const estado = this.suscripcion()?.estado ?? 'none';

    // `canceled` (cancelación definitiva, no programada): reusa el customer
    // Stripe existente y abre Checkout sin nuevo trial (Bloque D del plan).
    // No usamos `abrirPortal` porque el Portal no permite re-suscribirse
    // desde cero a un customer cuya subscription terminó.
    if (estado === 'canceled') {
      await this.subs.iniciarCheckout(id, this.varianteCards());
      return;
    }
    // Sub viva con cancelación programada (`active` o `trialing` con
    // `cancel_at_period_end: true`): la acción esperada es deshacer la
    // cancelación, no abrir Checkout/Portal. Este check va ANTES del de
    // `trialing` porque si no, una sub en trial con cancelación programada
    // caería en la rama de "Añadir método de pago" y abriría un Checkout
    // nuevo en lugar de reactivar la existente.
    if (this.cancelaAlFinDelPeriodo()) {
      await this.subs.reactivar(id);
      return;
    }
    // `trialing` abre Checkout en `mode: 'setup'` (solo recoge el método de
    // pago sobre la sub existente): la variante no aplica ahí.
    if (estado === 'trialing') {
      await this.subs.iniciarCheckout(id);
      return;
    }
    if (estado === 'none' || estado === 'incomplete') {
      await this.subs.iniciarCheckout(id, this.varianteCards());
      return;
    }
    await this.subs.abrirPortal(id);
  }

  protected etiquetaAccionPrincipal(): string {
    const estado = this.suscripcion()?.estado ?? 'none';
    if (estado === 'canceled') return 'Reactivar suscripción';
    if (this.cancelaAlFinDelPeriodo()) return 'Reactivar suscripción';
    // Sin tarjeta que cobre: la acción es añadirla (Portal en `active`,
    // Checkout setup en `trialing`; `accionPrincipal` ya enruta cada caso).
    if (this.metodoPagoPendiente()) return 'Añadir método de pago';
    if (estado === 'none' || estado === 'incomplete')
      return 'Activar suscripción';
    if (estado === 'trialing') return 'Añadir método de pago';
    if (estado === 'past_due' || estado === 'unpaid')
      return 'Actualizar método de pago';
    return 'Gestionar pago';
  }

  protected iconoAccionPrincipal(): string {
    const estado = this.suscripcion()?.estado ?? 'none';
    if (estado === 'past_due' || estado === 'unpaid') return 'credit_card';
    if (estado === 'canceled' || this.cancelaAlFinDelPeriodo())
      return 'restart_alt';
    if (estado === 'active') return 'settings';
    return 'arrow_forward';
  }

  protected abrirDialogContactarVentas(): void {
    const id = this.clinicId();
    if (!id) return;
    this.dialogService.open(ContactarVentasDialogComponent, {
      data: {
        clinicId: id,
        fisiosActuales: this.fisiosActuales(),
      },
      maxWidth: '480px',
    });
  }

  /**
   * Cambia entre variante base e ilimitada, con confirmación que muestra el
   * delta de precio. El backend hace el swap del price en Stripe con prorrateo.
   */
  protected async toggleIlimitado(): Promise<void> {
    const id = this.clinicId();
    const plan = this.planActual();
    if (!id || !plan) return;

    const aIlimitada = !this.esIlimitada();
    const precioActual = this.precioActualEur();
    const precioNuevo = this.precioOtraVarianteEur();

    const confirmado = await this.dialogService.confirm({
      title: aIlimitada ? 'Pasar a pacientes ilimitados' : 'Volver al plan base',
      message: aIlimitada
        ? `Tu suscripción pasará de ${precioActual} € a ${precioNuevo} €/mes + impuestos (prorrateado en el ciclo actual) y podrás vincular pacientes sin límite.`
        : `Tu suscripción pasará de ${precioActual} € a ${precioNuevo} €/mes + impuestos. El plan ${plan.nombre} base admite hasta ${plan.limitePacientes} pacientes vinculados.`,
      confirmText: aIlimitada ? 'Pasar a ilimitado' : 'Volver a base',
      cancelText: 'Cancelar',
    });
    if (!confirmado) return;

    await this.subs.cambiarVariante(id, aIlimitada ? 'ilimitada' : 'base');
  }

  protected async cancelarSuscripcion(): Promise<void> {
    const id = this.clinicId();
    if (!id) return;
    const confirmado = await this.dialogService.confirm({
      title: 'Cancelar suscripción',
      message:
        'La suscripción se cancelará al final del período actual. Mantendrás el acceso hasta entonces y podrás reactivarla cuando quieras.',
      confirmText: 'Cancelar suscripción',
      cancelText: 'Mantener',
      confirmVariant: 'danger',
    });
    if (!confirmado) return;
    await this.subs.cancelar(id);
  }
}
