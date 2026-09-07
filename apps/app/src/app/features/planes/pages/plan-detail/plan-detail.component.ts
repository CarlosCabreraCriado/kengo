import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location, NgOptimizedImage } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { assetUrl, rawAssetUrl } from '../../../../core/utils/asset-url';

import { PlanesService } from '../../data-access/planes.service';
import { PlanBuilderService } from '../../data-access/plan-builder.service';
import { CumplimientoService } from '../../../pacientes/data-access/cumplimiento.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import { LoggerService } from '../../../../core/services/logger.service';
import {
  EstadoPlan,
  PlanCompleto,
  Usuario,
  DiaSemana,
} from '../../../../../types/global';
import { DialogService, ToastService } from '../../../../../app/shared';
import type { DialogoPdfData } from '../../../../../app/shared';
import type {
  CopiarPlanDestino,
  CopiarPlanSheetData,
} from '../../components/copiar-plan-sheet/copiar-plan-sheet.component';
import {
  getTodayYmd,
  patientTzOf,
  ymdToDateForDisplay,
} from '../../../../shared/utils/date-tz.util';
import {
  ESTADO_DESCRIPCION,
  estadoLabelOf,
  estadoVariantOf,
  transicionesPermitidas,
} from '../../data-access/plan-estado.constants';
import {
  Ui2AvatarComponent,
  Ui2BackButtonComponent,
  Ui2BigTitleComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2IconBadgeComponent,
  Ui2KpiCardComponent,
  Ui2PillComponent,
  Ui2SectionLabelComponent,
} from '../../../../shared/ui-v2';
import { PlanWeekDotsComponent } from '../../components/plan-week-dots/plan-week-dots.component';
import { PlanMiniCalendarComponent } from '../../components/plan-mini-calendar/plan-mini-calendar.component';
import { useResponsive } from '../../../../shared/composables/use-responsive';

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [
    NgOptimizedImage,
    Ui2AvatarComponent,
    Ui2BackButtonComponent,
    Ui2BigTitleComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2IconBadgeComponent,
    Ui2KpiCardComponent,
    Ui2PillComponent,
    Ui2SectionLabelComponent,
    PlanWeekDotsComponent,
    PlanMiniCalendarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-detail.component.html',
  styleUrl: './plan-detail.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full',
  },
})
export class PlanDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private planesService = inject(PlanesService);
  private planBuilderService = inject(PlanBuilderService);
  private cumplimientoService = inject(CumplimientoService);
  public sessionService = inject(SessionService);
  private dialogService = inject(DialogService);
  private dialog = inject(Dialog);
  private toastService = inject(ToastService);
  private pageLoader = inject(PageLoaderService);
  private logger = inject(LoggerService);
  private readonly PAGE_LOADER_KEY = 'plan-detail';
  /** En móvil PDF y Copiar van solo con icono para que las 4 acciones quepan en una fila. */
  readonly esMobile = useResponsive().esMobile;

  plan = signal<PlanCompleto | null>(null);
  isLoading = signal(true);

  /** Datos críticos: plan cargado. */
  readonly pageReady = computed(() => !this.isLoading());

  actionType = signal<'created' | 'updated' | null>(null);

  showSuccessHero = computed(() => this.actionType() !== null);

  heroTitle = computed(() => {
    const action = this.actionType();
    if (action === 'created') return 'Plan creado';
    if (action === 'updated') return 'Plan actualizado';
    return '';
  });

  heroSubtitle = computed(() => {
    const action = this.actionType();
    if (action === 'created') return 'El plan ha sido asignado correctamente al paciente.';
    if (action === 'updated') return 'Los cambios se han guardado correctamente.';
    return '';
  });

  paciente = computed(() => {
    const p = this.plan();
    return p?.paciente as Usuario | null;
  });

  items = computed(() => this.plan()?.items || []);
  totalEjercicios = computed(() => this.items().length);

  /** Unión de los días de la semana cubiertos por al menos un ejercicio. */
  diasActivos = computed<DiaSemana[]>(() => {
    const set = new Set<DiaSemana>();
    for (const item of this.items()) {
      for (const d of item.diasSemana ?? []) set.add(d);
    }
    const order: DiaSemana[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    return order.filter((d) => set.has(d));
  });

  diasPorSemana = computed(() => this.diasActivos().length);

  backRoute = computed<unknown[]>(() => {
    if (this.sessionService.enModoPaciente()) return ['/inicio'];
    const pacId = this.paciente()?.id;
    return pacId ? ['/mis-pacientes', pacId] : ['/mis-pacientes'];
  });

  pageOverline = computed(() => {
    const total = this.totalEjercicios();
    return total > 0 ? `${total} ejercicio${total === 1 ? '' : 's'}` : 'Plan de tratamiento';
  });

  // ===== Adherencia / Dolor =====
  adherencia = signal<number | null>(null);
  dolorPromedio = signal<number | null>(null);

  tieneActividad = computed(
    () => this.adherencia() !== null || this.dolorPromedio() !== null,
  );

  adherenciaLabel = computed(() => {
    const v = this.adherencia();
    return v === null ? null : `Adherencia ${v}%`;
  });

  /** Color semántico para el pill de dolor (0-3 verde, 4-6 ámbar, 7-10 rojo). */
  dolorColor = computed<string>(() => {
    const v = this.dolorPromedio();
    if (v === null) return 'var(--ink-500)';
    if (v <= 3) return 'var(--success, #22c55e)';
    if (v <= 6) return 'var(--warning, #f59e0b)';
    return 'var(--danger, #ef4444)';
  });

  diasSemana: Record<string, string> = {
    L: 'Lun',
    M: 'Mar',
    X: 'Mie',
    J: 'Jue',
    V: 'Vie',
    S: 'Sab',
    D: 'Dom',
  };

  diasSemanaArray: DiaSemana[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  // ===== Estado del plan =====
  estadoActual = computed<EstadoPlan>(() => (this.plan()?.estado as EstadoPlan) ?? 'borrador');

  estadoActualLabel = computed(() => estadoLabelOf(this.estadoActual()));
  estadoActualVariant = computed(() => estadoVariantOf(this.estadoActual()));
  estadoActualDescripcion = computed(() => ESTADO_DESCRIPCION[this.estadoActual()]);

  /**
   * True cuando el plan es una versión histórica (fue reemplazado por otra
   * versión más reciente). En este estado el plan es inmutable: no se
   * muestran acciones de edición/eliminación ni transiciones de estado.
   */
  esModificado = computed(() => this.estadoActual() === 'modificado');

  /**
   * Id de la versión que sustituyó a este plan, solo si sigue existiendo
   * (`sucesorExiste` lo deriva el backend). En una cadena rota (sucesor
   * borrado o cancelado) se oculta el CTA en vez de navegar a un plan
   * inexistente; el mantenimiento nocturno restaura este plan.
   */
  planSucesorId = computed<string | null>(() => {
    const p = this.plan();
    return p?.planSucesor && p.sucesorExiste ? p.planSucesor : null;
  });

  /** True si las fechas del plan permiten que esté en estado "activo". */
  puedeActivar = computed(() => {
    const p = this.plan();
    if (!p?.fechaInicio || !p?.fechaFin) return false;
    // "Hoy" del PACIENTE del plan: su último día cuenta completo.
    return p.fechaFin >= getTodayYmd(patientTzOf(p.paciente as Usuario | null));
  });

  transicionesDisponibles = computed<EstadoPlan[]>(() =>
    transicionesPermitidas(this.estadoActual()),
  );

  estadoLabel(estado: EstadoPlan): string {
    return estadoLabelOf(estado);
  }

  ngOnInit() {
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);

    const action = this.route.snapshot.queryParams['action'];
    if (action === 'created' || action === 'updated') {
      this.actionType.set(action);
      // El hero de éxito ya está fijado en memoria: quitar `?action` de la
      // URL (sin renavegar) para que volver atrás a esta página, o recargarla,
      // no vuelva a tratarse como "recién creado" y resetee el carrito.
      this.location.replaceState(this.location.path().split('?')[0]);
    }

    const planId = this.route.snapshot.params['id'];
    if (planId) {
      this.loadPlan(planId);
    } else {
      this.router.navigate(this.backRoute());
    }
  }

  ngOnDestroy() {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
  }

  private async loadPlan(id: string) {
    this.isLoading.set(true);
    try {
      const plan = await this.planesService.getPlanById(id);
      if (plan) {
        this.plan.set(plan);
        // Solo hay estado obsoleto que limpiar al venir del builder (plan
        // creado/actualizado: `submitPlan` no vacía los items en memoria) o
        // si quedó un modo edición abandonado. Un carrito de plan nuevo se
        // conserva: resetear siempre borraba, vía autosave, el borrador en
        // localStorage del paciente activo con solo abrir un detalle.
        if (this.actionType() !== null || this.planBuilderService.isEditMode()) {
          this.planBuilderService.resetForNewPlan();
        }
        this.cargarMetricasPaciente(plan);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Carga adherencia y dolor promedio del paciente en la ventana del plan.
   * Falla silenciosamente: si hay error o no hay datos, deja los signals en null
   * y la UI oculta los pills/KPI correspondientes.
   */
  private async cargarMetricasPaciente(plan: PlanCompleto) {
    const pacienteId = (plan.paciente as Usuario | null)?.id;
    if (!pacienteId) return;
    const desde = plan.fechaInicio || undefined;
    const hasta =
      plan.fechaFin ||
      getTodayYmd(patientTzOf(plan.paciente as Usuario | null));
    try {
      const resp = await this.cumplimientoService.getCumplimiento(
        pacienteId,
        desde,
        hasta,
      );
      if (resp.resumen.diasProgramados > 0) {
        this.adherencia.set(resp.resumen.adherenciaReal);
      }
      const dolores = resp.dias
        .map((d) => d.dolorPromedio)
        .filter((v): v is number => v != null);
      if (dolores.length > 0) {
        const avg = dolores.reduce((a, b) => a + b, 0) / dolores.length;
        this.dolorPromedio.set(Math.round(avg * 10) / 10);
      }
    } catch (err) {
      this.logger.warn('[plan-detail] error cargando métricas del paciente', err);
    }
  }

  verPerfilPaciente() {
    const pac = this.paciente();
    if (pac?.id && this.sessionService.puedeGestionarPacientes()) {
      this.router.navigate(['/mis-pacientes', pac.id]);
    }
  }

  irAInicio() {
    this.router.navigate(['/inicio']);
  }

  editarPlan() {
    const p = this.plan();
    if (!p || this.esModificado()) return;
    this.router.navigate(['/planes', p.id, 'editar']);
  }

  irAVersionActual() {
    const sucesor = this.planSucesorId();
    if (sucesor) this.router.navigate(['/planes', sucesor]);
  }

  /**
   * Copia los ejercicios del plan al carrito para crear un plan nuevo (para
   * el mismo paciente u otro) y lleva al catálogo con el carrito abierto.
   * Disponible también en planes históricos (`modificado`), completados y
   * cancelados: reutilizar un plan antiguo es un caso de uso legítimo.
   */
  async copiarPlan(): Promise<void> {
    const p = this.plan();
    if (!p || !this.sessionService.puedeEditarRecursos()) return;
    const total = this.totalEjercicios();
    if (total === 0) return;

    const pacienteOrigen = this.paciente();
    const nombreOrigen =
      `${pacienteOrigen?.first_name ?? ''} ${pacienteOrigen?.last_name ?? ''}`.trim() ||
      'el mismo paciente';

    const { CopiarPlanSheetComponent } = await import(
      '../../components/copiar-plan-sheet/copiar-plan-sheet.component'
    );
    const sheetRef = this.dialogService.openSheet<
      InstanceType<typeof CopiarPlanSheetComponent>,
      CopiarPlanSheetData,
      CopiarPlanDestino | null
    >(CopiarPlanSheetComponent, {
      data: { pacienteNombre: nombreOrigen, totalEjercicios: total },
    });
    const destino = await firstValueFrom(sheetRef.closed);
    if (!destino) return;

    let pacienteDestino: Usuario | null = null;
    if (destino === 'mismo') {
      if (!pacienteOrigen?.id) return;
      // El paciente del `PlanCompleto` es un usuario básico (sin avatar):
      // se resuelve completo para que la pestaña del carrito lo muestre igual
      // que si viniera del selector. Si falla, el básico sirve.
      try {
        pacienteDestino =
          (await this.planBuilderService.getPacienteById(pacienteOrigen.id)) ??
          pacienteOrigen;
      } catch (err) {
        this.logger.warn('[plan-detail] no se pudo resolver el paciente', err);
        pacienteDestino = pacienteOrigen;
      }
    } else {
      pacienteDestino = await this.seleccionarPaciente();
    }
    if (!pacienteDestino) return;

    // Reemplazar solo con aviso si hay algo que perder: el carrito en
    // memoria o un borrador persistido del paciente destino.
    const enCarrito = this.planBuilderService.items().length;
    const enBorrador = this.planBuilderService.countItemsFor(pacienteDestino.id);
    const previos = Math.max(enCarrito, enBorrador);
    if (previos > 0) {
      const confirmed = await this.dialogService.confirm({
        title: 'Reemplazar carrito',
        message: `El carrito ya tiene ${previos} ${previos === 1 ? 'ejercicio' : 'ejercicios'}. Se sustituirán por los ${total} de este plan.`,
        confirmText: 'Reemplazar',
        cancelText: 'Cancelar',
      });
      if (!confirmed) return;
    }

    const res = this.planBuilderService.loadFromPlan(p, pacienteDestino);
    if (res.cargados === 0) {
      this.toastService.error('Este plan no tiene ejercicios que se puedan copiar');
      return;
    }

    this.toastService.success(
      `${res.cargados} ${res.cargados === 1 ? 'ejercicio copiado' : 'ejercicios copiados'} al carrito de ${pacienteDestino.first_name}`,
    );
    if (res.omitidos > 0) {
      this.toastService.warning(
        `${res.omitidos} ${res.omitidos === 1 ? 'ejercicio ya no existe' : 'ejercicios ya no existen'} en el catálogo y se ${res.omitidos === 1 ? 'ha' : 'han'} omitido`,
      );
    }

    this.planBuilderService.navigateAndOpenDrawer();
  }

  /** Mismo patrón que `rutinas-list` y el carrito: selector de la clínica activa. */
  private async seleccionarPaciente(): Promise<Usuario | null> {
    const { SelectorPacienteComponent } = await import(
      '../../../../shared/ui/selector-paciente/selector-paciente.component'
    );
    const ref = this.dialog.open<Usuario | undefined>(SelectorPacienteComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'selector-paciente-dialog',
    });
    const paciente = await firstValueFrom(ref.closed);
    return paciente ?? null;
  }

  /**
   * Indica si la transición a `destino` está deshabilitada por reglas
   * de negocio (p.ej. activar requiere fechas válidas).
   */
  transicionDeshabilitada(destino: EstadoPlan): boolean {
    if (destino === 'activo') return !this.puedeActivar();
    return false;
  }

  async cambiarEstado(destino: EstadoPlan): Promise<void> {
    const p = this.plan();
    if (!p) return;
    if (this.transicionDeshabilitada(destino)) {
      this.toastService.error(
        'El plan necesita fecha de inicio y una fecha de fin no anterior a hoy para activarse.',
      );
      return;
    }

    const destinoLabel = estadoLabelOf(destino).toLowerCase();
    const isDanger = destino === 'cancelado';
    const confirmed = await this.dialogService.confirm({
      title: `Cambiar estado a ${estadoLabelOf(destino)}`,
      message: this.mensajeConfirmacionCambioEstado(destino, p.titulo),
      confirmText: isDanger ? 'Cancelar plan' : `Marcar como ${destinoLabel}`,
      cancelText: 'Cancelar',
      confirmVariant: isDanger ? 'danger' : 'primary',
    });
    if (!confirmed) return;

    const success = await this.planesService.updateEstado(p.id, destino);
    if (!success) {
      this.toastService.error('No se pudo actualizar el estado del plan');
      return;
    }
    this.plan.update((current) =>
      current ? { ...current, estado: destino } : null,
    );
    this.toastService.success(`Plan actualizado a ${destinoLabel}`);
  }

  private mensajeConfirmacionCambioEstado(
    destino: EstadoPlan,
    titulo: string,
  ): string {
    switch (destino) {
      case 'activo':
        return `El plan "${titulo}" pasará a estado activo y el paciente podrá verlo.`;
      case 'borrador':
        return `El plan "${titulo}" volverá a borrador y dejará de ser visible para el paciente.`;
      case 'completado':
        return `El plan "${titulo}" se marcará como completado y se conservará en el historial.`;
      case 'cancelado':
        return `El plan "${titulo}" se cancelará y dejará de estar accesible para el paciente.`;
      case 'modificado':
        return '';
    }
  }

  async eliminarPlan(): Promise<void> {
    const p = this.plan();
    if (!p) return;

    // Mismo criterio que el backend (`plans.remove`): así el aviso coincide
    // con lo que va a pasar (cancelar vs borrar). Si la consulta falla, cae a
    // la heurística local de adherencia/dolor.
    let conActividad = this.tieneActividad();
    try {
      conActividad = await this.planesService.checkPlanHasActivity(p.id);
    } catch (err) {
      this.logger.warn('No se pudo comprobar la actividad del plan:', err);
    }

    const restauraAnterior = !!p.planAnterior;
    const versionAnterior = Math.max(1, (p.version ?? 2) - 1);
    const base = conActividad
      ? `El plan "${p.titulo}" tiene registros del paciente, así que se conservará en el historial como cancelado y dejará de estar accesible.`
      : `El plan "${p.titulo}" se eliminará permanentemente. Esta acción no se puede deshacer.`;
    const message = restauraAnterior
      ? `${base} La versión anterior (v${versionAnterior}) volverá a estar disponible.`
      : base;

    const confirmed = await this.dialogService.confirm({
      title: 'Eliminar plan',
      message,
      confirmText: 'Eliminar plan',
      cancelText: 'Cancelar',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;

    const result = await this.planesService.removePlan(p.id);
    if (!result) {
      this.toastService.error('Error al eliminar el plan');
      return;
    }
    const baseToast = result.softDeleted
      ? 'Plan cancelado y conservado en el historial'
      : 'Plan eliminado';
    this.toastService.success(
      result.predecesorRestaurado
        ? `${baseToast}. Se ha restaurado la versión anterior`
        : baseToast,
    );
    if (result.predecesorRestaurado) {
      this.router.navigate(['/planes', result.predecesorRestaurado]);
    } else {
      this.router.navigate(this.backRoute() as unknown[]);
    }
  }

  // `dateStr` es una fecha CIVIL YYYY-MM-DD: parsearla con `new Date()` la
  // interpretaba como medianoche UTC y `toLocaleDateString` sin timeZone la
  // formateaba en la TZ del dispositivo → un día MENOS en cualquier offset
  // negativo (usuario de viaje en América). Ancla a 12:00 UTC + timeZone UTC.
  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return ymdToDateForDisplay(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  formatDateShort(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return ymdToDateForDisplay(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
  }

  /** Portada sin transformar: el loader de NgOptimizedImage aplica el tamaño (modo `fill`). */
  portadaUrl(id: string | null | undefined): string {
    return rawAssetUrl(id);
  }

  avatarUrl(id: string | null | undefined): string | null {
    if (!id) return null;
    return `${assetUrl(id, { width: 100, height: 100, fit: 'cover', format: 'webp' })}`;
  }

  async abrirOpcionesPdf() {
    const p = this.plan();
    if (!p) return;

    const pac = this.paciente();
    const data: DialogoPdfData = {
      planConvexId: p.id,
      pacienteEmail: pac?.email ?? undefined,
      planTitulo: p.titulo,
    };

    const { DialogoPdfComponent } = await import(
      '../../../../../app/shared/ui/dialogo-pdf/dialogo-pdf.component'
    );
    this.dialogService.openForm<InstanceType<typeof DialogoPdfComponent>, DialogoPdfData>(
      DialogoPdfComponent,
      { data },
    );
  }
}
