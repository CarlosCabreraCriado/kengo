import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { assetUrl } from '../../../../core/utils/asset-url';
import { Router, ActivatedRoute } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

// Servicios
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanesService } from '../../../planes/data-access/planes.service';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { DialogService } from '../../../../shared/ui/dialog/dialog.service';
import { CumplimientoService } from '../../data-access/cumplimiento.service';
import { ComentariosPacienteService } from '../../data-access/comentarios-paciente.service';
import { AsignacionesService } from '../../data-access/asignaciones.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { api } from '../../../../../../../../convex/_generated/api';

// Componentes
import { AddPacienteDialogComponent } from '../../components/add-paciente/add-paciente.component';
import { GestionAccesoDialogComponent } from '../../components/gestion-acceso-dialog/gestion-acceso-dialog.component';

// Tipos
import {
  Usuario,
  Plan,
  EstadoPlan,
  RegistroEjercicioRecord,
  TipoCumplimiento,
  CumplimientoDia,
  NotificacionFisio,
} from '../../../../../types/global';
import { KENGO_BREAKPOINTS } from '../../../../shared';

interface ComentarioSesion {
  texto: string;
  idRegistro: string;
}

interface SesionAgrupada {
  fecha: string;
  fechaFormateada: string;
  registros: RegistroEjercicioRecord[];
  totalEjercicios: number;
  promedioDolorValue: number | null;
  comentarios: ComentarioSesion[];
  totalComentarios: number;
  tipo: TipoCumplimiento;
  ejerciciosEsperados: number;
  planes: { plan_id: string; titulo: string; esperados: number; completados: number }[];
}

interface EstadisticasPaciente {
  totalSesiones: number;
  adherenciaGeneral: number;
  promedioDolorGeneral: number | null;
  diasDesdeUltimaSesion: number | null;
  rachaActual: number;
  adherenciaSemanal: { semana: string; porcentaje: number }[];
}

@Component({
  selector: 'app-paciente-detail',
  standalone: true,
  imports: [
    DecimalPipe,
  ],
  templateUrl: './paciente-detail.component.html',
  styleUrl: './paciente-detail.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class PacienteDetailComponent implements OnInit {
  // Expose Math to template
  Math = Math;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private planBuilderService = inject(PlanBuilderService);
  private breakpointObserver = inject(BreakpointObserver);
  private cumplimientoService = inject(CumplimientoService);
  private comentariosService = inject(ComentariosPacienteService);
  private asignacionesService = inject(AsignacionesService);
  private convex = inject(ConvexService);

  // Detectar si es móvil (< 768px) - alineado con breakpoint de navegación
  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((result) => result.matches)),
    { initialValue: true },
  );

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

  // Descarga de informes
  readonly descargandoInforme = signal<string | null>(null);

  // Error state
  readonly error = signal<string | null>(null);

  // Section expansion states (collapsed on mobile by default)
  private readonly _inicioExpandido = window.matchMedia('(min-width: 768px)').matches;
  planesExpanded = this._inicioExpandido;
  statsExpanded = this._inicioExpandido;
  activityExpanded = this._inicioExpandido;
  comentariosExpanded = this._inicioExpandido;

  // Comentarios expansion
  readonly sesionExpandida = signal<string | null>(null);

  // Filtro de rango temporal
  readonly filtroRango = signal<'15' | '30' | '60' | '90' | 'todo' | 'custom'>('15');
  readonly filtroDesde = signal<string | null>(null);
  readonly filtroHasta = signal<string | null>(null);
  readonly filterPanelOpen = signal(false);
  readonly hoy = new Date().toISOString().split('T')[0];

  // Computed
  readonly idsClinicas = computed(() => {
    return this.sessionService.usuario()?.clinicas.map((c) => c.id_clinica) || [];
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
    const all = this.sesiones();
    return this.filtroRango() === '15' ? all.slice(0, 15) : all;
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
        if (plan.estado === 'activo' && plan.fecha_fin) {
          const fechaFin = new Date(plan.fecha_fin);
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
      let registrosPorFecha = new Map<string, RegistroEjercicioRecord[]>();

      if (diasConActividad.length > 0) {
        const fechas = diasConActividad.map(d => d.fecha);
        const registros = await this.cargarRegistrosParaFechas(pacienteId, fechas);
        registrosPorFecha = this.agruparRegistrosPorFecha(registros);
      }

      // Construir sesiones agrupadas fusionando cumplimiento + registros
      const sesiones: SesionAgrupada[] = dias.map(dia => {
        const regs = registrosPorFecha.get(dia.fecha) || [];
        const dolores = regs.filter(r => r.dolor_escala != null).map(r => r.dolor_escala!);
        const promedioDolor = dolores.length > 0
          ? Math.round((dolores.reduce((a, b) => a + b, 0) / dolores.length) * 10) / 10
          : dia.dolor_promedio;
        const comentarios = regs
          .filter(r => r.nota_paciente && r.nota_paciente.trim().length > 0)
          .map(r => ({ texto: r.nota_paciente!, idRegistro: r.id_registro }));

        return {
          fecha: dia.fecha,
          fechaFormateada: this.formatearFecha(dia.fecha),
          registros: regs,
          totalEjercicios: dia.ejercicios_completados,
          promedioDolorValue: promedioDolor,
          comentarios,
          totalComentarios: comentarios.length,
          tipo: dia.tipo,
          ejerciciosEsperados: dia.ejercicios_esperados,
          planes: dia.planes.filter(p => p.esperados > 0),
        };
      });

      this.sesiones.set(sesiones);

      // Calcular estadísticas desde cumplimiento
      const resumen = cumplimiento.resumen;
      const doloresGenerales = sesiones
        .filter(s => s.promedioDolorValue !== null)
        .map(s => s.promedioDolorValue!);
      const promedioDolorGeneral = doloresGenerales.length > 0
        ? Math.round((doloresGenerales.reduce((a, b) => a + b, 0) / doloresGenerales.length) * 10) / 10
        : null;

      // Días desde última sesión con actividad
      const ultimoDiaActividad = dias.find(d => d.tipo === 'completado' || d.tipo === 'parcial');
      let diasDesdeUltimaSesion: number | null = null;
      if (ultimoDiaActividad) {
        const ultima = new Date(ultimoDiaActividad.fecha);
        const hoy = new Date();
        diasDesdeUltimaSesion = Math.floor((hoy.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Racha: iterar días hacia atrás, saltando descanso
      const rachaActual = this.calcularRachaCumplimiento(dias);

      // Adherencia semanal basada en cumplimiento
      const adherenciaSemanal = this.calcularAdherenciaSemanalCumplimiento(dias);

      this.estadisticas.set({
        totalSesiones: resumen.dias_completados + resumen.dias_parciales,
        adherenciaGeneral: resumen.adherencia_real,
        promedioDolorGeneral,
        diasDesdeUltimaSesion,
        rachaActual,
        adherenciaSemanal,
      });
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

    // Mapear el shape Convex (camelCase) al shape RegistroEjercicioRecord (snake_case) que el resto del componente espera.
    return (records ?? []).map((r) => ({
      id_registro: r._id,
      plan_item: r.planExerciseId,
      paciente: r.pacienteId,
      fecha_hora: r.fechaHora,
      completado: r.completado,
      repeticiones_realizadas: r.repeticionesRealizadas,
      duracion_real_seg: r.duracionRealSeg,
      dolor_escala: r.dolorEscala,
      nota_paciente: r.notaPaciente,
    }));
  }

  private agruparRegistrosPorFecha(
    registros: RegistroEjercicioRecord[],
  ): Map<string, RegistroEjercicioRecord[]> {
    const grupos = new Map<string, RegistroEjercicioRecord[]>();
    for (const reg of registros) {
      const fecha = reg.fecha_hora.split('T')[0];
      if (!grupos.has(fecha)) {
        grupos.set(fecha, []);
      }
      grupos.get(fecha)!.push(reg);
    }
    return grupos;
  }

  private calcularRachaCumplimiento(dias: CumplimientoDia[]): number {
    // Días ordenados de más reciente a más antiguo (ya vienen así del backend)
    const sorted = [...dias].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const hoy = new Date().toISOString().split('T')[0];

    let racha = 0;
    let fechaEsperada = new Date(hoy);

    for (const dia of sorted) {
      // Saltar días de descanso
      if (dia.tipo === 'descanso') continue;

      const fechaDia = new Date(dia.fecha);
      const diffDias = Math.floor(
        (fechaEsperada.getTime() - fechaDia.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDias <= 1) {
        if (dia.tipo === 'completado') {
          racha++;
          fechaEsperada = fechaDia;
        } else {
          // Parcial o fallido rompe la racha
          break;
        }
      } else {
        break;
      }
    }

    return racha;
  }

  private calcularAdherenciaSemanalCumplimiento(
    dias: CumplimientoDia[],
  ): { semana: string; porcentaje: number }[] {
    const resultado: { semana: string; porcentaje: number }[] = [];
    const hoy = new Date();

    for (let i = 0; i < 4; i++) {
      const finSemana = new Date(hoy);
      finSemana.setDate(hoy.getDate() - (i * 7));
      const inicioSemana = new Date(finSemana);
      inicioSemana.setDate(finSemana.getDate() - 6);

      const inicioStr = inicioSemana.toISOString().split('T')[0];
      const finStr = finSemana.toISOString().split('T')[0];

      const diasSemana = dias.filter(d =>
        d.fecha >= inicioStr && d.fecha <= finStr && d.tipo !== 'descanso',
      );
      const programados = diasSemana.length;
      const completados = diasSemana.filter(d => d.tipo === 'completado').length;
      const porcentaje = programados > 0 ? Math.round((completados / programados) * 100) : 0;

      resultado.push({ semana: `Sem ${4 - i}`, porcentaje });
    }

    return resultado.reverse();
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
      list.map(c => c.id === comentario.id ? { ...c, revisada: true, fecha_revision: new Date().toISOString() } : c)
    );
    this.comentariosPendientes.update(n => Math.max(0, n - 1));

    try {
      await this.comentariosService.marcarRevisada(comentario.id);
    } catch (err) {
      console.error('Error marcando comentario como revisado:', err);
      // Revert on error
      this.comentarios.update(list =>
        list.map(c => c.id === comentario.id ? { ...c, revisada: false, fecha_revision: null } : c)
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
      list.map(c => ({ ...c, revisada: true, fecha_revision: c.fecha_revision || new Date().toISOString() }))
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

  buscarNotificacion(idRegistro: number | string): NotificacionFisio | undefined {
    const key = String(idRegistro);
    return this.comentarios().find(n => n.id_registro !== null && String(n.id_registro) === key);
  }

  formatearFechaComentario(fecha: string): string {
    const d = new Date(fecha);
    const day = d.getDate();
    const month = d.toLocaleDateString('es-ES', { month: 'short' });
    return `${day} ${month}`;
  }

  // === Helpers de formato ===

  avatarUrl(): string | null {
    const p = this.paciente();
    if (!p?.avatar) return null;
    return `${assetUrl(p.avatar, { fit: 'cover', width: 128, height: 128, quality: 80 })}`;
  }

  fullName(): string {
    const p = this.paciente();
    if (!p) return '';
    const fn = (p.first_name || '').trim();
    const ln = (p.last_name || '').trim();
    return fn || ln ? `${fn} ${ln}`.trim() : p.email || p.id;
  }

  getClinicaNombre(): string | null {
    const p = this.paciente();
    if (!p?.clinicas || p.clinicas.length === 0) return null;
    const clinica = p.clinicas[0] as any;
    return clinica?.id_clinica?.nombre || null;
  }

  formatearFecha(fecha: string): string {
    const d = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    const esAyer = d.toDateString() === ayer.toDateString();

    const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' });
    const day = d.getDate();
    const month = d.toLocaleDateString('es-ES', { month: 'long' });
    const year = d.getFullYear() !== hoy.getFullYear() ? ` ${d.getFullYear()}` : '';
    const label = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day} ${month}${year}`;
    return esAyer ? `${label} (Ayer)` : label;
  }

  getPlanStatusClass(plan: { esperados: number; completados: number }): string {
    if (plan.completados >= plan.esperados) return 'status-completado';
    if (plan.completados > 0) return 'status-parcial';
    return 'status-fallido';
  }

  getEstadoLabel(estado: EstadoPlan): string {
    const labels: Record<EstadoPlan, string> = {
      borrador: 'Borrador',
      activo: 'Activo',
      completado: 'Completado',
      cancelado: 'Cancelado',
    };
    return labels[estado] || estado;
  }

  getEstadoClass(estado: EstadoPlan): string {
    const classes: Record<EstadoPlan, string> = {
      borrador: 'bg-zinc-100 text-zinc-600',
      activo: 'bg-green-100 text-green-700',
      completado: 'bg-blue-100 text-blue-700',
      cancelado: 'bg-red-100 text-red-600',
    };
    return classes[estado] || 'bg-zinc-100 text-zinc-600';
  }

  getDolorColor(dolor: number | null): string {
    if (dolor === null) return 'text-zinc-400';
    if (dolor <= 3) return 'text-green-600';
    if (dolor <= 6) return 'text-yellow-600';
    return 'text-red-600';
  }

  tieneComentarios(sesion: SesionAgrupada): boolean {
    if (sesion.totalComentarios > 0) return true;
    // Session-level observations from notifications
    return this.comentarios().some(c =>
      c.id_sesion !== null && c.fecha_registro.split('T')[0] === sesion.fecha
    );
  }

  toggleComentarios(fecha: string): void {
    this.sesionExpandida.update(current => current === fecha ? null : fecha);
  }

  getTipoIcon(tipo: TipoCumplimiento): string {
    const icons: Record<TipoCumplimiento, string> = {
      completado: 'check_circle',
      parcial: 'warning',
      fallido: 'cancel',
      descanso: 'bedtime',
    };
    return icons[tipo];
  }

  getTipoColor(tipo: TipoCumplimiento): string {
    const colors: Record<TipoCumplimiento, string> = {
      completado: 'text-success',
      parcial: 'text-amber',
      fallido: 'text-danger',
      descanso: 'text-zinc-400',
    };
    return colors[tipo];
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
      this.planBuilderService.cambiarPaciente(p);
    }
  }

  verPlan(plan: Plan) {
    this.router.navigate(['/planes', plan.id_plan]);
  }

  editarPlan(plan: Plan) {
    this.router.navigate(['/planes', plan.id_plan, 'editar']);
  }

  verSesion(sesion: SesionAgrupada) {
    // No navegar para días sin actividad o de descanso
    if (sesion.tipo === 'descanso') return;
    const pacienteId = this.route.snapshot.params['id'];
    this.router.navigate(['/mis-pacientes', pacienteId, 'sesion', sesion.fecha]);
  }

  irASesionComentario(comentario: NotificacionFisio) {
    const pacienteId = this.route.snapshot.params['id'];
    const fecha = comentario.fecha_registro.split('T')[0];
    this.router.navigate(['/mis-pacientes', pacienteId, 'sesion', fecha]);
  }

  verTodosPlanes() {
    const p = this.paciente();
    if (p) {
      this.planesService.clearFilters();
      this.planesService.setFiltroPaciente(p.id);
      this.router.navigate(['/planes']);
    }
  }

  // === Descarga de informes ===

  async descargarInforme(plan: Plan) {
    if (this.descargandoInforme()) return;

    this.descargandoInforme.set(plan.id_plan);

    try {
      const res = await this.convex.action(api.pdf.actions.generatePlanPdf, {
        planId: plan.id_plan as any,
      });
      if (!res?.url) throw new Error('No se pudo generar el PDF');

      const response = await fetch(res.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = res.filename;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error descargando informe:', err);
      alert('Error al descargar el informe');
    } finally {
      this.descargandoInforme.set(null);
    }
  }
}
