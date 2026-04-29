import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { assetUrl } from '../../../../core/utils/asset-url';
import { Router, ActivatedRoute } from '@angular/router';
import { useResponsive } from '../../../../shared';

// Servicios
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanesService } from '../../../planes/data-access/planes.service';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { DialogService } from '../../../../shared/ui/dialog/dialog.service';
import { CumplimientoService } from '../../data-access/cumplimiento.service';
import { ComentariosPacienteService } from '../../data-access/comentarios-paciente.service';
import { AsignacionesService } from '../../data-access/asignaciones.service';
import { ClinicasService } from '../../../clinica/data-access/clinicas.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { api } from '../../../../../../../../convex/_generated/api';

// Componentes
import { AddPacienteDialogComponent } from '../../components/add-paciente/add-paciente.component';
import { GestionAccesoDialogComponent } from '../../components/gestion-acceso-dialog/gestion-acceso-dialog.component';
import { PacientePlanesListComponent } from './componentes/paciente-planes-list/paciente-planes-list.component';
import { PacienteComentariosPanelComponent } from './componentes/paciente-comentarios-panel/paciente-comentarios-panel.component';
import { PacienteHeroCardComponent } from './componentes/paciente-hero-card/paciente-hero-card.component';
import { PacienteEstadisticasComponent } from './componentes/paciente-estadisticas/paciente-estadisticas.component';
import { PacienteActividadRecienteComponent } from './componentes/paciente-actividad-reciente/paciente-actividad-reciente.component';
import {
  Ui2BackButtonComponent,
  Ui2EmptyStateComponent,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';

// Tipos
import {
  Usuario,
  Plan,
  RegistroEjercicioRecord,
  NotificacionFisio,
} from '../../../../../types/global';
import {
  EstadisticasPaciente,
  RangoFiltro,
  SesionAgrupada,
} from '../../data-access/paciente-detail.types';

@Component({
  selector: 'app-paciente-detail',
  standalone: true,
  imports: [
    PacientePlanesListComponent,
    PacienteComentariosPanelComponent,
    PacienteHeroCardComponent,
    PacienteEstadisticasComponent,
    PacienteActividadRecienteComponent,
    Ui2BackButtonComponent,
    Ui2EmptyStateComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './paciente-detail.component.html',
  styleUrl: './paciente-detail.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class PacienteDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private planBuilderService = inject(PlanBuilderService);
  private cumplimientoService = inject(CumplimientoService);
  private comentariosService = inject(ComentariosPacienteService);
  private asignacionesService = inject(AsignacionesService);
  private clinicasService = inject(ClinicasService);
  private convex = inject(ConvexService);

  // Responsive: < 768px se considera móvil (KENGO_BREAKPOINTS.MOBILE).
  private readonly responsive = useResponsive();
  readonly isMovil = this.responsive.esMobile;

  // Estado
  readonly paciente = signal<Usuario | null>(null);
  readonly planes = signal<Plan[]>([]);
  readonly sesiones = signal<SesionAgrupada[]>([]);
  readonly estadisticas = signal<EstadisticasPaciente | null>(null);

  // Loading states
  readonly isLoadingPaciente = signal(true);
  readonly isLoadingPlanes = signal(true);
  readonly isLoadingSesiones = signal(true);
  readonly isLoadingEstadisticas = signal(true);

  // Comentarios del paciente (notificaciones)
  readonly comentarios = signal<NotificacionFisio[]>([]);
  readonly comentariosPendientes = signal<number>(0);
  readonly isLoadingComentarios = signal(true);

  // Fisio responsable
  readonly fisioResponsableNombre = signal<string | null>(null);

  // Error state
  readonly error = signal<string | null>(null);

  // Comentarios expansion
  readonly sesionExpandida = signal<string | null>(null);

  // Filtro de rango temporal
  readonly filtroRango = signal<RangoFiltro>('15');
  readonly filtroDesde = signal<string | null>(null);
  readonly filtroHasta = signal<string | null>(null);
  readonly filterPanelOpen = signal(false);
  readonly hoy = new Date().toISOString().split('T')[0];

  // Computed
  readonly idsClinicas = computed(() => {
    return this.sessionService.usuario()?.clinicas.map((c) => c.clinicId) || [];
  });

  readonly isCustomRange = computed(() => {
    const r = this.filtroRango();
    return r !== '15' && r !== 'todo';
  });

  readonly rangoLabel = computed(() => {
    const rango = this.filtroRango();
    if (rango === '15') return 'Últimos 15 días';
    if (rango === '30') return 'Últimos 30 días';
    if (rango === '60') return 'Últimos 60 días';
    if (rango === '90') return 'Últimos 90 días';
    if (rango === 'todo') return 'Todo el historial';
    const desde = this.filtroDesde();
    const hasta = this.filtroHasta();
    if (desde && hasta) {
      const formatShort = (s: string) => {
        const d = new Date(s);
        return `${d.getDate()} ${d.toLocaleDateString('es-ES', { month: 'short' })}`;
      };
      return `${formatShort(desde)} - ${formatShort(hasta)}`;
    }
    return 'Rango personalizado';
  });

  readonly sesionesVisibles = computed(() => {
    const all = this.sesionesEnriquecidas();
    return this.filtroRango() === '15' ? all.slice(0, 15) : all;
  });

  /**
   * Re-evalúa `tieneObservacionSesion` reactivamente cada vez que
   * cambian sesiones o comentarios. Esto asegura que el badge
   * `act-has-comments` aparezca cuando llega la lista de notificaciones
   * después de las sesiones (orden de carga no garantizado).
   */
  readonly sesionesEnriquecidas = computed(() =>
    this.cumplimientoService.enriquecerSesionesConNotificaciones(
      this.sesiones(),
      this.comentarios(),
    ),
  );

  /**
   * Index `idRegistro -> NotificacionFisio` para que el subcomponente de
   * actividad pueda decidir si mostrar el botón "marcar como leído" sin
   * leer la lista global de comentarios.
   */
  readonly notificacionesPorRegistro = computed(() => {
    const map: Record<string, NotificacionFisio> = {};
    for (const n of this.comentarios()) {
      if (n.id !== null && n.id !== undefined) {
        map[String(n.id)] = n;
      }
    }
    return map;
  });

  ngOnInit() {
    const pacienteId = this.route.snapshot.params['id'];
    if (pacienteId) {
      this.cargarPaciente(pacienteId);
      this.cargarPlanes(pacienteId);
      this.cargarCumplimiento(pacienteId);
      this.cargarComentarios(pacienteId);
      this.cargarFisioResponsable(pacienteId);
    } else {
      this.router.navigate(['/mis-pacientes']);
    }
  }

  // === Carga de datos ===

  private async cargarPaciente(id: string) {
    this.isLoadingPaciente.set(true);
    this.error.set(null);

    try {
      const data = await this.convex.query(api.users.queries.getById, {
        userId: id as any,
      });

      if (data) {
        const usuario = this.sessionService.transformarUsuarioConvex(data);
        this.paciente.set(usuario);
      } else {
        this.error.set('Paciente no encontrado');
        this.router.navigate(['/mis-pacientes']);
      }
    } catch (err) {
      console.error('Error cargando paciente:', err);
      this.error.set('Error al cargar el paciente');
    } finally {
      this.isLoadingPaciente.set(false);
    }
  }

  private async cargarPlanes(pacienteId: string) {
    this.isLoadingPlanes.set(true);

    try {
      const planes = await this.planesService.getPlanesByPaciente(pacienteId);

      // Corregir estado de planes expirados localmente
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const planesCorregidos = planes.map(plan => {
        if (plan.estado === 'activo' && plan.fechaFin) {
          const fechaFin = new Date(plan.fechaFin);
          fechaFin.setHours(0, 0, 0, 0);
          if (fechaFin < hoy) {
            return { ...plan, estado: 'completado' as const };
          }
        }
        return plan;
      });

      this.planes.set(planesCorregidos);
    } catch (err) {
      console.error('Error cargando planes:', err);
    } finally {
      this.isLoadingPlanes.set(false);
    }
  }

  private async cargarCumplimiento(pacienteId: string, desde?: string, hasta?: string) {
    this.isLoadingSesiones.set(true);
    this.isLoadingEstadisticas.set(true);

    try {
      const cumplimiento = await this.cumplimientoService.getCumplimiento(pacienteId, desde, hasta);
      const dias = cumplimiento.dias;

      // Cargar registros desde Convex para días con actividad (para comentarios y drill-down)
      const diasConActividad = dias.filter(d => d.tipo !== 'fallido' && d.tipo !== 'descanso');
      const registros: RegistroEjercicioRecord[] =
        diasConActividad.length > 0
          ? await this.cargarRegistrosParaFechas(
              pacienteId,
              diasConActividad.map((d) => d.fecha),
            )
          : [];

      const sesiones = this.cumplimientoService.buildSesionesAgrupadas(
        dias,
        registros,
        this.comentarios(),
      );
      this.sesiones.set(sesiones);
      this.estadisticas.set(
        this.cumplimientoService.buildEstadisticas(
          dias,
          sesiones,
          cumplimiento.resumen,
        ),
      );
    } catch (err) {
      console.error('Error cargando cumplimiento:', err);
    } finally {
      this.isLoadingSesiones.set(false);
      this.isLoadingEstadisticas.set(false);
    }
  }

  private async cargarRegistrosParaFechas(
    pacienteId: string,
    fechas: string[],
  ): Promise<RegistroEjercicioRecord[]> {
    // Determinar rango de fechas para filtrar
    const sortedFechas = [...fechas].sort();
    const desde = sortedFechas[0];
    const hasta = sortedFechas[sortedFechas.length - 1];

    // Modelo nuevo (Fase 3 rediseño records): lectura desde `exerciseExecutions`.
    // Sin paginationOpts → devuelve array (no PaginationResult).
    const records = (await this.convex.query(
      api.executions.queries.listByPacienteInRange,
      {
        pacienteId,
        desde,
        hasta,
        soloCompletados: true,
      },
    )) as Array<{
      _id: string;
      planExerciseId: string;
      pacienteId: string;
      fechaHora: string;
      completado: boolean;
      repeticionesRealizadas?: number;
      duracionRealSeg?: number;
      dolorEscala?: number;
      notaPaciente?: string;
    }>;

    return (records ?? []).map((r) => ({
      id: r._id,
      planItemId: r.planExerciseId,
      pacienteId: r.pacienteId,
      fechaHora: r.fechaHora,
      completado: r.completado,
      repeticionesRealizadas: r.repeticionesRealizadas,
      duracionRealSeg: r.duracionRealSeg,
      dolorEscala: r.dolorEscala,
      notaPaciente: r.notaPaciente,
    }));
  }

  // === Comentarios del paciente ===

  private async cargarComentarios(pacienteId: string) {
    this.isLoadingComentarios.set(true);
    try {
      const response = await this.comentariosService.getComentarios(pacienteId);
      this.comentarios.set(response.comentarios);
      this.comentariosPendientes.set(response.pendientes);
    } catch (err) {
      console.error('Error cargando comentarios:', err);
    } finally {
      this.isLoadingComentarios.set(false);
    }
  }

  private cargarFisioResponsable(pacienteId: string) {
    const clinicaIds = this.idsClinicas();
    if (!clinicaIds || clinicaIds.length === 0) return;

    this.asignacionesService
      .getFisioResponsable(pacienteId, String(clinicaIds[0]))
      .subscribe({
        next: (asignacion) => {
          if (asignacion) {
            const fn = (asignacion.nombreFisio || '').trim();
            const ln = (asignacion.apellidoFisio || '').trim();
            this.fisioResponsableNombre.set(
              fn || ln ? `${fn} ${ln}`.trim() : null
            );
          }
        },
        error: () => {},
      });
  }

  async marcarComentarioRevisado(comentario: NotificacionFisio) {
    if (comentario.revisada) return;

    // Optimistic update
    this.comentarios.update(list =>
      list.map(c => c.id === comentario.id ? { ...c, revisada: true, fechaRevision: new Date().toISOString() } : c)
    );
    this.comentariosPendientes.update(n => Math.max(0, n - 1));

    try {
      await this.comentariosService.marcarRevisada(comentario.id);
    } catch (err) {
      console.error('Error marcando comentario como revisado:', err);
      // Revert on error
      this.comentarios.update(list =>
        list.map(c => c.id === comentario.id ? { ...c, revisada: false, fechaRevision: null } : c)
      );
      this.comentariosPendientes.update(n => n + 1);
    }
  }

  async marcarTodosRevisados() {
    const pacienteId = this.route.snapshot.params['id'];
    if (!pacienteId) return;

    const prevComentarios = this.comentarios();
    const prevPendientes = this.comentariosPendientes();

    // Optimistic update
    this.comentarios.update(list =>
      list.map(c => ({ ...c, revisada: true, fechaRevision: c.fechaRevision || new Date().toISOString() }))
    );
    this.comentariosPendientes.set(0);

    try {
      await this.comentariosService.marcarTodasRevisadas(pacienteId);
    } catch (err) {
      console.error('Error marcando todos como revisados:', err);
      // Revert
      this.comentarios.set(prevComentarios);
      this.comentariosPendientes.set(prevPendientes);
    }
  }

  // === Computed de presentación del paciente (consumidos por hero-card) ===

  readonly avatarUrl = computed<string | null>(() => {
    const p = this.paciente();
    if (!p?.avatar) return null;
    return `${assetUrl(p.avatar, { fit: 'cover', width: 128, height: 128, quality: 80 })}`;
  });

  readonly fullName = computed<string>(() => {
    const p = this.paciente();
    if (!p) return '';
    const fn = (p.first_name || '').trim();
    const ln = (p.last_name || '').trim();
    return fn || ln ? `${fn} ${ln}`.trim() : p.email || p.id;
  });

  readonly clinicaNombre = computed<string | null>(() => {
    const p = this.paciente();
    if (!p?.clinicas || p.clinicas.length === 0) return null;
    const clinicId = p.clinicas[0].clinicId;
    const clinica = this.clinicasService
      .misClinicasRes
      .value()
      ?.find((c) => c.id === clinicId);
    return clinica?.nombre ?? null;
  });

  toggleComentarios(fecha: string): void {
    this.sesionExpandida.update(current => current === fecha ? null : fecha);
  }

  diasSinActividad(): number {
    return this.sesiones().filter(s => s.tipo === 'fallido').length;
  }

  diasProgramados(): number {
    return this.sesiones().filter(s => s.tipo !== 'descanso').length;
  }

  aplicarFiltroRango(rango: '15' | '30' | '60' | '90' | 'todo' | 'custom') {
    if (rango === 'custom') {
      this.filtroRango.set('custom');
      this.filterPanelOpen.set(true);
      return;
    }

    this.filterPanelOpen.set(false);
    this.filtroRango.set(rango);

    const pacienteId = this.route.snapshot.params['id'];
    if (!pacienteId) return;

    if (rango === '15') {
      // Default: let backend use its default 30d, we slice to 15
      this.filtroDesde.set(null);
      this.filtroHasta.set(null);
      this.cargarCumplimiento(pacienteId);
    } else if (rango === 'todo') {
      const desdeStr = '2020-01-01';
      const hastaStr = new Date().toISOString().split('T')[0];
      this.filtroDesde.set(desdeStr);
      this.filtroHasta.set(hastaStr);
      this.cargarCumplimiento(pacienteId, desdeStr, hastaStr);
    } else {
      const dias = parseInt(rango);
      const hasta = new Date();
      const desde = new Date();
      desde.setDate(hasta.getDate() - dias);
      const desdeStr = desde.toISOString().split('T')[0];
      const hastaStr = hasta.toISOString().split('T')[0];
      this.filtroDesde.set(desdeStr);
      this.filtroHasta.set(hastaStr);
      this.cargarCumplimiento(pacienteId, desdeStr, hastaStr);
    }
  }

  aplicarRangoPersonalizado() {
    const desde = this.filtroDesde();
    const hasta = this.filtroHasta();
    if (!desde || !hasta || desde > hasta) return;

    this.filterPanelOpen.set(false);
    const pacienteId = this.route.snapshot.params['id'];
    if (pacienteId) {
      this.cargarCumplimiento(pacienteId, desde, hasta);
    }
  }

  onDesdeChange(event: Event) {
    this.filtroDesde.set((event.target as HTMLInputElement).value || null);
  }

  onHastaChange(event: Event) {
    this.filtroHasta.set((event.target as HTMLInputElement).value || null);
  }

  resetearFiltro() {
    this.aplicarFiltroRango('15');
  }

  // === Acciones ===

  volver() {
    this.router.navigate(['/mis-pacientes']);
  }

  editarPaciente() {
    const p = this.paciente();
    if (!p) return;

    this.dialogService
      .open(AddPacienteDialogComponent, {
        maxWidth: '520px',
        data: { clinicIds: this.idsClinicas(), usuario: p },
      })
      .closed
      .subscribe((r: any) => {
        if (r?.updated) {
          this.cargarPaciente(p.id);
        }
      });
  }

  gestionarAcceso() {
    const p = this.paciente();
    if (!p) return;

    this.dialogService.open(GestionAccesoDialogComponent, {
      data: { paciente: p },
      maxWidth: '400px',
    });
  }

  crearPlan() {
    const p = this.paciente();
    if (p) {
      this.planBuilderService.prepareForPaciente(p);
      this.planBuilderService.navigateAndOpenDrawer();
    }
  }

  verPlan(plan: Plan) {
    this.router.navigate(['/planes', plan.id]);
  }

  editarPlan(plan: Plan) {
    this.router.navigate(['/planes', plan.id, 'editar']);
  }

  verSesion(sesion: SesionAgrupada) {
    // No navegar para días sin actividad o de descanso
    if (sesion.tipo === 'descanso') return;
    const pacienteId = this.route.snapshot.params['id'];
    this.router.navigate(['/mis-pacientes', pacienteId, 'sesion', sesion.fecha]);
  }

  irASesionComentario(comentario: NotificacionFisio) {
    const pacienteId = this.route.snapshot.params['id'];
    const fecha = comentario.fechaRegistro.split('T')[0];
    this.router.navigate(['/mis-pacientes', pacienteId, 'sesion', fecha]);
  }

}
