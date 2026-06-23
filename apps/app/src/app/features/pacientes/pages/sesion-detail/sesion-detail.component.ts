import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DecimalPipe, NgOptimizedImage } from '@angular/common';
import { useResponsive } from '../../../../shared';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../../core/auth/services/clinica-activa.service';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import type { Usuario } from '../../../../../types/global';
import { assetUrl } from '../../../../core/utils/asset-url';
import { ConvexService } from '../../../../core/convex/convex.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { api } from '../../../../../../../../convex/_generated/api';
import { ymdToDateForDisplay } from '../../../../shared/utils/madrid-date.util';
import {
  Ui2AvatarComponent,
  Ui2BackButtonComponent,
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2IconBadgeComponent,
  Ui2KpiCardComponent,
  Ui2PillComponent,
  Ui2ProgressBarComponent,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';

type EstadoDia = 'completado' | 'parcial' | 'fallido' | 'descanso' | 'sin_plan';

interface EjercicioDetalle {
  planExerciseId: string;
  sort: number;
  nombre: string;
  portada: string | null;
  series?: number;
  repeticiones?: number;
  duracionSeg?: number;
  instruccionesPaciente?: string;
  programadoHoy: boolean;
  completado: boolean;
  repeticionesRealizadas?: number;
  duracionRealSeg?: number;
  dolorEscala?: number;
  esfuerzoEscala?: number;
  notaPaciente?: string;
  fechaHora?: string;
}

interface PlanDetalle {
  planId: string;
  titulo: string;
  esperados: number;
  completados: number;
  ejercicios: EjercicioDetalle[];
}

@Component({
  selector: 'app-sesion-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    NgOptimizedImage,
    Ui2AvatarComponent,
    Ui2BackButtonComponent,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2IconBadgeComponent,
    Ui2KpiCardComponent,
    Ui2PillComponent,
    Ui2ProgressBarComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './sesion-detail.component.html',
  styleUrl: './sesion-detail.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class SesionDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private pageLoader = inject(PageLoaderService);
  private logger = inject(LoggerService);
  private readonly PAGE_LOADER_KEY = 'sesion-detail';

  isMovil = useResponsive().esMobile;

  // State
  readonly planes = signal<PlanDetalle[]>([]);
  readonly estadoDia = signal<EstadoDia | null>(null);
  readonly totalEsperados = signal(0);
  readonly totalCompletados = signal(0);
  readonly dolorMedio = signal<number | null>(null);
  readonly fecha = signal<string>('');
  readonly pacienteId = signal<string>('');
  readonly paciente = signal<Usuario | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  /** Datos críticos del primer paint: detalle cargado (success o vacío). */
  readonly pageReady = computed(() => !this.isLoading());

  // Computed
  readonly hayPlanes = computed(() => this.planes().length > 0);

  readonly totalComentarios = computed(() =>
    this.planes().reduce(
      (sum, p) =>
        sum +
        p.ejercicios.filter((e) => e.completado && e.notaPaciente?.trim())
          .length,
      0,
    ),
  );

  readonly estadoLabel = computed<string>(() => {
    switch (this.estadoDia()) {
      case 'completado':
        return 'Completada';
      case 'parcial':
        return 'Parcial';
      case 'fallido':
        return 'Sin completar';
      case 'descanso':
      case 'sin_plan':
        return 'Descanso';
      default:
        return '';
    }
  });

  readonly estadoIcon = computed<string>(() => {
    switch (this.estadoDia()) {
      case 'completado':
        return 'check_circle';
      case 'parcial':
        return 'pending';
      case 'fallido':
        return 'cancel';
      default:
        return 'bedtime';
    }
  });

  readonly estadoColor = computed<string>(() => {
    switch (this.estadoDia()) {
      case 'completado':
        return 'var(--success)';
      case 'parcial':
        return 'var(--warning)';
      case 'fallido':
        return 'var(--danger)';
      default:
        return 'var(--ink-400)';
    }
  });

  readonly pacienteNombre = computed<string>(() => {
    const p = this.paciente();
    if (!p) return '';
    const fn = (p.first_name || '').trim();
    const ln = (p.last_name || '').trim();
    return fn || ln ? `${fn} ${ln}`.trim() : p.email || '';
  });

  readonly pacienteAvatarUrl = computed<string | null>(() => {
    const p = this.paciente();
    if (!p?.avatar) return null;
    return assetUrl(p.avatar, {
      fit: 'cover',
      width: 128,
      height: 128,
      quality: 80,
    });
  });

  ngOnInit() {
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);

    const id = this.route.snapshot.params['id'];
    const fecha = this.route.snapshot.params['fecha'];

    if (!id || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      this.router.navigate(['/mis-pacientes']);
      return;
    }

    this.pacienteId.set(id);
    this.fecha.set(fecha);
    this.cargarPaciente();
    this.cargarDetalleDia();
  }

  ngOnDestroy(): void {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
  }

  private async cargarPaciente() {
    try {
      const data = await this.convex.query(api.users.queries.getById, {
        userId: this.pacienteId() as never,
      });
      if (data) {
        this.paciente.set(this.sessionService.transformarUsuarioConvex(data));
      }
    } catch (err) {
      this.logger.error('Error cargando paciente:', err);
    }
  }

  /**
   * Carga el desglose del día por plan desde la misma lógica que el rollup
   * (`getDayDetailByPaciente`), de modo que los contadores coinciden con el
   * timeline de actividad y se muestran TODOS los planes del día (incluidos los
   * pendientes), no solo los que tienen ejercicios completados.
   */
  private async cargarDetalleDia() {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const clinicId = this.clinicaActiva.selectedClinicaId();
      const dia = await this.convex.query(
        api.sessions.queries.getDayDetailByPaciente,
        {
          pacienteId: this.pacienteId(),
          fecha: this.fecha(),
          ...(clinicId ? { clinicId: clinicId as never } : {}),
        },
      );

      if (dia) {
        this.planes.set((dia.planes ?? []) as PlanDetalle[]);
        this.estadoDia.set(dia.estadoDia as EstadoDia);
        this.totalEsperados.set(dia.totalEsperados);
        this.totalCompletados.set(dia.totalCompletados);
        this.dolorMedio.set(dia.dolorPromedio ?? null);
      }
    } catch (err) {
      this.logger.error('Error cargando detalle de sesión:', err);
      this.error.set('Error al cargar los detalles de la sesión');
    } finally {
      this.isLoading.set(false);
    }
  }

  // === Helpers de plan ===

  planPorcentaje(plan: PlanDetalle): number {
    if (plan.esperados <= 0) return plan.completados > 0 ? 100 : 0;
    return Math.min(100, Math.round((plan.completados / plan.esperados) * 100));
  }

  planColor(plan: PlanDetalle): 'success' | 'warning' | 'danger' {
    if (plan.esperados > 0 && plan.completados >= plan.esperados)
      return 'success';
    if (plan.completados > 0) return 'warning';
    return 'danger';
  }

  // === Helpers ===

  formatearFechaLarga(fecha: string): string {
    const d = ymdToDateForDisplay(fecha);
    return d.toLocaleDateString('es-ES', {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  /**
   * Devuelve el color V2 (token CSS) para un valor de dolor, usado por
   * `ui2-pill variant="custom"` y por el KPI de dolor.
   */
  getDolorColor(dolor: number | null): string {
    if (dolor === null) return 'var(--ink-400)';
    if (dolor <= 3) return 'var(--success)';
    if (dolor <= 6) return 'var(--warning)';
    return 'var(--danger)';
  }

  assetUrl(portada: string | null): string | null {
    if (!portada) return null;
    return `${assetUrl(portada, { fit: 'cover', width: 160, height: 160, quality: 80 })}`;
  }

  formatDuracion(seg: number): string {
    if (seg < 60) return `${seg}s`;
    const min = Math.floor(seg / 60);
    const rest = seg % 60;
    return rest > 0 ? `${min}m ${rest}s` : `${min}m`;
  }

  // === Navigation ===

  volver() {
    this.router.navigate(['/mis-pacientes', this.pacienteId()]);
  }

  verPlan(planId: string) {
    this.router.navigate(['/planes', planId]);
  }
}
