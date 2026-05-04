import { Component, inject, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { assetUrl } from '../../../../core/utils/asset-url';

import { PlanesService } from '../../data-access/planes.service';
import { PlanBuilderService } from '../../data-access/plan-builder.service';
import { CumplimientoService } from '../../../pacientes/data-access/cumplimiento.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import { PlanCompleto, Usuario, DiaSemana } from '../../../../../types/global';
import { DialogService, DialogoPdfComponent } from '../../../../../app/shared';
import type { DialogoPdfData } from '../../../../../app/shared';
import { getMadridDate } from '../../../../shared/utils/madrid-date.util';
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

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [
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
  templateUrl: './plan-detail.component.html',
  styleUrl: './plan-detail.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full',
  },
})
export class PlanDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private planesService = inject(PlanesService);
  private planBuilderService = inject(PlanBuilderService);
  private cumplimientoService = inject(CumplimientoService);
  public sessionService = inject(SessionService);
  private dialogService = inject(DialogService);
  private pageLoader = inject(PageLoaderService);
  private readonly PAGE_LOADER_KEY = 'plan-detail';

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

  ngOnInit() {
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);

    const action = this.route.snapshot.queryParams['action'];
    if (action === 'created' || action === 'updated') {
      this.actionType.set(action);
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
        this.planBuilderService.resetForNewPlan();
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
    const hasta = plan.fechaFin || getMadridDate();
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
      console.warn('[plan-detail] error cargando métricas del paciente', err);
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
    if (p) {
      this.router.navigate(['/planes', p.id, 'editar']);
    }
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatDateShort(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    });
  }

  assetUrl(id: string | null | undefined, w = 100, h = 100): string {
    if (!id) return '';
    return `${assetUrl(id, { width: w, height: h, fit: 'cover', format: 'webp' })}`;
  }

  avatarUrl(id: string | null | undefined): string | null {
    if (!id) return null;
    return `${assetUrl(id, { width: 100, height: 100, fit: 'cover', format: 'webp' })}`;
  }

  abrirOpcionesPdf() {
    const p = this.plan();
    if (!p) return;

    const pac = this.paciente();
    const data: DialogoPdfData = {
      planConvexId: (p as unknown as { _convexId: string })._convexId,
      pacienteEmail: pac?.email ?? undefined,
      planTitulo: p.titulo,
    };

    this.dialogService.open<DialogoPdfComponent, DialogoPdfData>(
      DialogoPdfComponent,
      { data }
    );
  }
}
