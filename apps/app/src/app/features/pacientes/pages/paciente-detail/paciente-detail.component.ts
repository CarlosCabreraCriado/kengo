import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { environment as env } from '../../../../../environments/environment';

// Servicios
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanesService } from '../../../planes/data-access/planes.service';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { DialogService } from '../../../../shared/ui/dialog/dialog.service';
import { CumplimientoService } from '../../data-access/cumplimiento.service';

// Componentes
import { AddPacienteDialogComponent } from '../../components/add-paciente/add-paciente.component';
import { GestionAccesoDialogComponent } from '../../components/gestion-acceso-dialog/gestion-acceso-dialog.component';

// Tipos
import {
  Usuario,
  UsuarioDirectus,
  Plan,
  EstadoPlan,
  RegistroEjercicioDirectus,
  TipoCumplimiento,
  CumplimientoDia,
} from '../../../../../types/global';
import { KENGO_BREAKPOINTS } from '../../../../shared';

interface DirectusUserResponse {
  data: UsuarioDirectus;
}

interface RegistrosResponse {
  data: RegistroEjercicioDirectus[];
}

interface SesionAgrupada {
  fecha: string;
  fechaFormateada: string;
  registros: RegistroEjercicioDirectus[];
  totalEjercicios: number;
  promedioDolorValue: number | null;
  comentarios: string[];
  totalComentarios: number;
  tipo: TipoCumplimiento;
  ejerciciosEsperados: number;
  planes: { plan_id: number; titulo: string; esperados: number; completados: number }[];
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
  private http = inject(HttpClient);
  private dialogService = inject(DialogService);
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private planBuilderService = inject(PlanBuilderService);
  private breakpointObserver = inject(BreakpointObserver);
  private cumplimientoService = inject(CumplimientoService);

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

  // Descarga de informes
  readonly descargandoInforme = signal<number | null>(null);

  // Error state
  readonly error = signal<string | null>(null);

  // Section expansion states
  planesExpanded = true;
  statsExpanded = true;
  activityExpanded = false;

  // Comentarios expansion
  readonly sesionExpandida = signal<string | null>(null);

  // Computed
  readonly idsClinicas = computed(() => {
    return this.sessionService.usuario()?.clinicas.map((c) => c.id_clinica) || [];
  });

  ngOnInit() {
    const pacienteId = this.route.snapshot.params['id'];
    if (pacienteId) {
      this.cargarPaciente(pacienteId);
      this.cargarPlanes(pacienteId);
      this.cargarCumplimiento(pacienteId);
    } else {
      this.router.navigate(['/mis-pacientes']);
    }
  }

  // === Carga de datos ===

  private async cargarPaciente(id: string) {
    this.isLoadingPaciente.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<DirectusUserResponse>(`${env.DIRECTUS_URL}/users/${id}`, {
          params: {
            fields: 'id,first_name,last_name,email,avatar,telefono,direccion,magic_link_url,clinicas.id_clinica.id_clinica,clinicas.id_clinica.nombre,clinicas.id_puesto',
          },
          withCredentials: true,
        })
      );

      if (response?.data) {
        const usuario = this.sessionService.transformarUsuarioDirectus(response.data);
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

  private async cargarCumplimiento(pacienteId: string) {
    this.isLoadingSesiones.set(true);
    this.isLoadingEstadisticas.set(true);

    try {
      const cumplimiento = await this.cumplimientoService.getCumplimiento(pacienteId);
      const dias = cumplimiento.dias;

      // Cargar registros de Directus para días con actividad (para comentarios y drill-down)
      const diasConActividad = dias.filter(d => d.tipo !== 'fallido' && d.tipo !== 'descanso');
      let registrosPorFecha = new Map<string, RegistroEjercicioDirectus[]>();

      if (diasConActividad.length > 0) {
        const fechas = diasConActividad.map(d => d.fecha);
        const registros = await this.cargarRegistrosParaFechas(pacienteId, fechas);
        registrosPorFecha = this.agruparRegistrosPorFecha(registros);
      }

      // Construir sesiones agrupadas fusionando cumplimiento + registros
      const sesiones: SesionAgrupada[] = dias.map(dia => {
        const regs = registrosPorFecha.get(dia.fecha) || [];
        const dolores = regs.filter(r => r.dolor_escala != null).map(r => r.dolor_escala!);
        const promedioDolor = dia.dolor_promedio ??
          (dolores.length > 0 ? dolores.reduce((a, b) => a + b, 0) / dolores.length : null);
        const comentarios = regs
          .map(r => r.nota_paciente)
          .filter((n): n is string => !!n && n.trim().length > 0);

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
          planes: dia.planes,
        };
      });

      this.sesiones.set(sesiones);

      // Calcular estadísticas desde cumplimiento
      const resumen = cumplimiento.resumen;
      const doloresGenerales = dias
        .filter(d => d.dolor_promedio !== null)
        .map(d => d.dolor_promedio!);
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
  ): Promise<RegistroEjercicioDirectus[]> {
    // Determinar rango de fechas para filtrar
    const sortedFechas = [...fechas].sort();
    const desde = sortedFechas[0];
    const hasta = sortedFechas[sortedFechas.length - 1];

    const response = await firstValueFrom(
      this.http.get<RegistrosResponse>(`${env.DIRECTUS_URL}/items/planes_registros`, {
        params: {
          fields: 'id_registro,plan_item,paciente,fecha_hora,completado,repeticiones_realizadas,duracion_real_seg,dolor_escala,nota_paciente',
          filter: JSON.stringify({
            _and: [
              { paciente: { _eq: pacienteId } },
              { completado: { _eq: true } },
              { fecha_hora: { _gte: desde + 'T00:00:00' } },
              { fecha_hora: { _lte: hasta + 'T23:59:59' } },
            ],
          }),
          sort: '-fecha_hora',
          limit: '-1',
        },
        withCredentials: true,
      })
    );
    return response?.data || [];
  }

  private agruparRegistrosPorFecha(
    registros: RegistroEjercicioDirectus[],
  ): Map<string, RegistroEjercicioDirectus[]> {
    const grupos = new Map<string, RegistroEjercicioDirectus[]>();
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

  // === Helpers de formato ===

  avatarUrl(): string | null {
    const p = this.paciente();
    if (!p?.avatar) return null;
    return `${env.DIRECTUS_URL}/assets/${p.avatar}?fit=cover&width=128&height=128&quality=80`;
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
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';

    const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' });
    const day = d.getDate();
    const month = d.toLocaleDateString('es-ES', { month: 'long' });
    const year = d.getFullYear() !== hoy.getFullYear() ? ` ${d.getFullYear()}` : '';
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day} ${month}${year}`;
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
    if (sesion.tipo === 'fallido' || sesion.tipo === 'descanso') return;
    const pacienteId = this.route.snapshot.params['id'];
    this.router.navigate(['/mis-pacientes', pacienteId, 'sesion', sesion.fecha]);
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
      const response = await firstValueFrom(
        this.http.get(`${env.API_URL}/plan/${plan.id_plan}/pdf`, {
          responseType: 'blob',
          observe: 'response',
          withCredentials: true,
        })
      );

      if (response.body) {
        // Extraer nombre del archivo del header Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `plan_${plan.id_plan}.pdf`;

        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
          if (match && match[1]) {
            filename = match[1];
          }
        }

        // Crear blob y descargar
        const blob = new Blob([response.body], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error('Error descargando informe:', err);

      // Intentar parsear el error JSON del backend
      let errorMessage = 'Error al descargar el informe';

      if (err.error instanceof Blob) {
        try {
          const errorText = await err.error.text();
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // No se pudo parsear el error
        }
      } else if (err.error?.error) {
        errorMessage = err.error.error;
      }

      alert(errorMessage);
    } finally {
      this.descargandoInforme.set(null);
    }
  }
}
