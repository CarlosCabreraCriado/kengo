import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { SubscriptionService } from '../../../../core/billing/subscription.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { DialogService } from '../../../../shared/services/dialog/dialog.service';
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
  Ui2SpinnerComponent,
  Ui2PillVariant,
} from '../../../../shared/ui-v2';
import { api } from '../../../../../../../../convex/_generated/api';

import type {
  InvoiceEstado,
  InvoiceItem,
  PlanInfo,
  SubscriptionEstado,
} from '@kengo/shared-models';

interface EstadoVm {
  texto: string;
  variant: Ui2PillVariant;
  icon: string;
}

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
    Ui2SpinnerComponent,
  ],
  templateUrl: './suscripcion.component.html',
  styleUrl: './suscripcion.component.css',
  host: { class: 'block w-full' },
})
export class SuscripcionComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly convex = inject(ConvexService);
  private readonly dialogService = inject(DialogService);
  private readonly logger = inject(LoggerService);
  protected readonly subs = inject(SubscriptionService);

  protected readonly suscripcion = this.subs.suscripcion;
  protected readonly loading = this.subs.loading;
  protected readonly error = this.subs.error;

  protected readonly clinicId = this.subs.clinicIdAdmin;

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

  protected readonly progresoFisios = computed<number>(() => {
    const plan = this.planActual();
    if (!plan) return 0;
    return Math.min(100, (this.fisiosActuales() / plan.rangoFisiosMax) * 100);
  });

  protected readonly tierLleno = computed<boolean>(() => {
    const plan = this.planActual();
    if (!plan) return false;
    return this.fisiosActuales() >= plan.rangoFisiosMax;
  });

  protected readonly siguientePlan = computed<PlanInfo | null>(() => {
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

  protected readonly retornoStripe = toSignal(
    this.route.queryParamMap.pipe(
      map((qp) => {
        if (qp.has('ok')) return 'ok' as const;
        if (qp.has('cancel')) return 'cancel' as const;
        return null;
      }),
    ),
    { initialValue: null },
  );

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
    effect(() => {
      const id = this.clinicId();
      const sub = this.suscripcion();
      if (!id || !sub || sub.estado === 'none') {
        this.facturas.set([]);
        this.facturasError.set(null);
        return;
      }
      void this.cargarFacturas(id);
    });
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
      await this.subs.iniciarCheckout(id);
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
    if (
      estado === 'none' ||
      estado === 'trialing' ||
      estado === 'incomplete'
    ) {
      await this.subs.iniciarCheckout(id);
      return;
    }
    await this.subs.abrirPortal(id);
  }

  protected etiquetaAccionPrincipal(): string {
    const estado = this.suscripcion()?.estado ?? 'none';
    if (estado === 'canceled') return 'Reactivar suscripción';
    if (this.cancelaAlFinDelPeriodo()) return 'Reactivar suscripción';
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
