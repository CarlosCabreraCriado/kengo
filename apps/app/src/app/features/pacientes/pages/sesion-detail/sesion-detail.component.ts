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
import { DecimalPipe } from '@angular/common';
import { useResponsive } from '../../../../shared';
import { CumplimientoService } from '../../data-access/cumplimiento.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../../core/auth/services/clinica-activa.service';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import type { DiaSemana, Usuario } from '../../../../../types/global';
import { assetUrl } from '../../../../core/utils/asset-url';
import { ConvexService } from '../../../../core/convex/convex.service';
import { api } from '../../../../../../../../convex/_generated/api';
import {
  diaSemanaFromYMD,
  ymdToDateForDisplay,
} from '../../../../shared/utils/madrid-date.util';
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

interface RegistroExpandido {
  id: string;
  fechaHora: string;
  completado: boolean;
  repeticionesRealizadas?: number;
  duracionRealSeg?: number;
  dolorEscala?: number;
  esfuerzoEscala?: number;
  notaPaciente?: string;
  planItemId: {
    id: string;
    sort: number;
    series?: number;
    repeticiones?: number;
    duracionSeg?: number;
    instruccionesPaciente?: string;
    ejercicio: {
      id: string;
      nombre: string;
      portada: string | null;
    };
    plan: {
      id: string;
      titulo: string;
    };
  };
}

interface GrupoPlan {
  planId: string;
  planTitulo: string;
  registros: RegistroExpandido[];
}

interface EjercicioAgendado {
  id: string;
  sort: number;
  nombre: string;
  portada: string | null;
  series: number | null;
  repeticiones: number | null;
  duracionSeg: number | null;
}

interface PlanAgendadoDetalle {
  planId: string;
  titulo: string;
  esperados: number;
  completados: number;
  ejercicios: EjercicioAgendado[];
}

@Component({
  selector: 'app-sesion-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
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
  private cumplimientoService = inject(CumplimientoService);
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private pageLoader = inject(PageLoaderService);
  private readonly PAGE_LOADER_KEY = 'sesion-detail';

  isMovil = useResponsive().esMobile;

  // State
  readonly grupos = signal<GrupoPlan[]>([]);
  readonly fecha = signal<string>('');
  readonly pacienteId = signal<string>('');
  readonly paciente = signal<Usuario | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly planesAgendados = signal<PlanAgendadoDetalle[]>([]);
  readonly esFallido = signal(false);

  /** Datos críticos del primer paint: registros cargados (success o vacío). */
  readonly pageReady = computed(() => !this.isLoading());

  // Computed
  readonly totalEjercicios = computed(() =>
    this.grupos().reduce((sum, g) => sum + g.registros.length, 0),
  );

  readonly promedioDolor = computed(() => {
    const todos = this.grupos().flatMap((g) => g.registros);
    const dolores = todos
      .filter((r) => r.dolorEscala != null)
      .map((r) => r.dolorEscala!);
    if (dolores.length === 0) return null;
    return (
      Math.round((dolores.reduce((a, b) => a + b, 0) / dolores.length) * 10) /
      10
    );
  });

  readonly totalComentarios = computed(() => {
    const todos = this.grupos().flatMap((g) => g.registros);
    return todos.filter((r) => r.notaPaciente?.trim()).length;
  });

  readonly totalEsperados = computed(() =>
    this.planesAgendados().reduce((sum, p) => sum + p.esperados, 0),
  );

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
    return assetUrl(p.avatar, { fit: 'cover', width: 128, height: 128, quality: 80 });
  });

  readonly hayEstado = computed(
    () => this.totalEjercicios() > 0 || this.esFallido(),
  );

  readonly estadoIcon = computed(() =>
    this.esFallido() ? 'cancel' : 'check_circle',
  );

  readonly estadoLabel = computed(() =>
    this.esFallido() ? 'Sin actividad' : 'Completada',
  );

  readonly estadoColor = computed(() =>
    this.esFallido() ? 'var(--danger)' : 'var(--success)',
  );

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
    this.cargarRegistros();
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
      console.error('Error cargando paciente:', err);
    }
  }

  private async cargarRegistros() {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Modelo nuevo: 1 documento por sesión clínica con sus ejecuciones
      // (`exerciseExecutions`) ya agrupadas y expandidas. Un día tiene 1 sesión
      // habitualmente (BN1), pero la query devuelve array por compatibilidad.
      const clinicId = this.clinicaActiva.selectedClinicaId();
      const sesiones = (await this.convex.query(
        api.sessions.queries.getByPacienteAndDateWithExecutions,
        {
          pacienteId: this.pacienteId(),
          fecha: this.fecha(),
          soloCompletados: true,
          ...(clinicId ? { clinicId: clinicId as never } : {}),
        },
      )) ?? [];

      const validos: RegistroExpandido[] = [];
      for (const sesion of sesiones) {
        for (const e of sesion.executions ?? []) {
          if (!e.planExercise || !e.planExercise.exercise || !e.planExercise.plan) {
            continue;
          }
          validos.push({
            id: e._id,
            fechaHora: e.fechaHora,
            completado: e.completado,
            repeticionesRealizadas: e.repeticionesRealizadas,
            duracionRealSeg: e.duracionRealSeg,
            dolorEscala: e.dolorEscala,
            esfuerzoEscala: e.esfuerzoEscala,
            notaPaciente: e.notaPaciente,
            planItemId: {
              id: e.planExercise._id,
              sort: e.planExercise.sort,
              series: e.planExercise.series,
              repeticiones: e.planExercise.repeticiones,
              duracionSeg: e.planExercise.duracionSeg,
              instruccionesPaciente: e.planExercise.instruccionesPaciente,
              ejercicio: {
                id: e.planExercise.exercise._id,
                nombre: e.planExercise.exercise.nombreEjercicio,
                portada: e.planExercise.exercise.portada ?? null,
              },
              plan: {
                id: e.planExercise.plan._id,
                titulo: e.planExercise.plan.titulo,
              },
            },
          });
        }
      }

      validos.sort((a, b) => {
        if (a.planItemId.plan.id !== b.planItemId.plan.id) {
          return a.planItemId.plan.id.localeCompare(b.planItemId.plan.id);
        }
        return a.planItemId.sort - b.planItemId.sort;
      });

      this.grupos.set(this.agruparPorPlan(validos));

      if (validos.length === 0) {
        await this.cargarPlanesAgendados();
      }
    } catch (err) {
      console.error('Error cargando registros de sesión:', err);
      this.error.set('Error al cargar los detalles de la sesión');
    } finally {
      this.isLoading.set(false);
    }
  }

  private agruparPorPlan(registros: RegistroExpandido[]): GrupoPlan[] {
    const mapa = new Map<string, GrupoPlan>();

    for (const reg of registros) {
      const planId = reg.planItemId.plan.id;
      if (!mapa.has(planId)) {
        mapa.set(planId, {
          planId,
          planTitulo: reg.planItemId.plan.titulo,
          registros: [],
        });
      }
      mapa.get(planId)!.registros.push(reg);
    }

    return Array.from(mapa.values());
  }

  private async cargarPlanesAgendados() {
    try {
      const resp = await this.cumplimientoService.getCumplimiento(
        this.pacienteId(),
        this.fecha(),
        this.fecha(),
      );
      const dia = resp.dias.find((d) => d.fecha === this.fecha());
      if (!dia || dia.tipo !== 'fallido') return;

      const planesConEjercicios = dia.planes.filter((p) => p.esperados > 0);
      if (planesConEjercicios.length === 0) return;

      this.esFallido.set(true);

      const diaSemana = diaSemanaFromYMD(this.fecha());

      const ejerciciosPorPlan = await Promise.all(
        planesConEjercicios.map((p) =>
          this.convex.query(api.plans.queries.listExercisesByPlanId, {
            planId: p.planId as any,
          }),
        ),
      );

      this.planesAgendados.set(
        planesConEjercicios.map((p, i) => {
          const items = ((ejerciciosPorPlan[i] ?? []) as any[]).filter(
            (item: any) => {
              const dias = item.diasSemana as DiaSemana[] | undefined;
              if (!dias || dias.length === 0) return true;
              return dias.includes(diaSemana);
            },
          );
          return {
            ...p,
            ejercicios: items.map((item: any) => ({
              id: item._id,
              sort: item.sort,
              nombre: item.ejercicio?.nombreEjercicio ?? '',
              portada: item.ejercicio?.portada ?? null,
              series: item.series ?? null,
              repeticiones: item.repeticiones ?? null,
              duracionSeg: item.duracionSeg ?? null,
            })),
          };
        }),
      );
    } catch {
      // silently ignore — empty state will show
    }
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
