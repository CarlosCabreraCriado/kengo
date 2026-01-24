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

// Angular Material (only dialog)
import { MatDialog } from '@angular/material/dialog';

// Servicios
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanesService } from '../../../planes/data-access/planes.service';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';

// Componentes
import { AddPacienteDialogComponent } from '../../components/add-paciente/add-paciente.component';
import { QrDialogComponent } from '../../../../shared/ui/dialogo-qr/dialogo-qr.component';

// Tipos
import {
  Usuario,
  UsuarioDirectus,
  Plan,
  EstadoPlan,
  RegistroEjercicioDirectus,
} from '../../../../../types/global';

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
  private dialog = inject(MatDialog);
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private planBuilderService = inject(PlanBuilderService);
  private breakpointObserver = inject(BreakpointObserver);

  // Detectar si estamos en desktop (>= 1024px)
  isDesktop = toSignal(
    this.breakpointObserver
      .observe(['(min-width: 1024px)'])
      .pipe(map((result) => result.matches)),
    { initialValue: false }
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

  // Computed
  readonly idsClinicas = computed(() => {
    return this.sessionService.usuario()?.clinicas.map((c) => c.id_clinica) || [];
  });

  ngOnInit() {
    const pacienteId = this.route.snapshot.params['id'];
    if (pacienteId) {
      this.cargarPaciente(pacienteId);
      this.cargarPlanes(pacienteId);
      this.cargarSesiones(pacienteId);
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
            fields: 'id,first_name,last_name,email,avatar,telefono,direccion,magic_link_url,clinicas.id_clinica.id_clinica,clinicas.id_clinica.nombre,is_cliente,is_fisio',
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
      this.planes.set(planes);
    } catch (err) {
      console.error('Error cargando planes:', err);
    } finally {
      this.isLoadingPlanes.set(false);
    }
  }

  private async cargarSesiones(pacienteId: string) {
    this.isLoadingSesiones.set(true);

    try {
      const response = await firstValueFrom(
        this.http.get<RegistrosResponse>(`${env.DIRECTUS_URL}/items/planes_registros`, {
          params: {
            fields: 'id_registro,plan_item,paciente,fecha_hora,completado,repeticiones_realizadas,duracion_real_seg,dolor_escala,nota_paciente',
            filter: JSON.stringify({
              _and: [
                { paciente: { _eq: pacienteId } },
                { completado: { _eq: true } },
              ],
            }),
            sort: '-fecha_hora',
            limit: '100',
          },
          withCredentials: true,
        })
      );

      const registros = response?.data || [];
      const sesionesAgrupadas = this.agruparPorFecha(registros);
      this.sesiones.set(sesionesAgrupadas);

      // Calcular estadísticas después de cargar sesiones
      this.calcularEstadisticas(registros, pacienteId);
    } catch (err) {
      console.error('Error cargando sesiones:', err);
    } finally {
      this.isLoadingSesiones.set(false);
    }
  }

  private agruparPorFecha(registros: RegistroEjercicioDirectus[]): SesionAgrupada[] {
    const grupos: Map<string, RegistroEjercicioDirectus[]> = new Map();

    for (const reg of registros) {
      const fecha = reg.fecha_hora.split('T')[0];
      if (!grupos.has(fecha)) {
        grupos.set(fecha, []);
      }
      grupos.get(fecha)!.push(reg);
    }

    return Array.from(grupos.entries()).map(([fecha, regs]) => {
      const dolores = regs.filter(r => r.dolor_escala != null).map(r => r.dolor_escala!);
      const promedioDolor = dolores.length > 0
        ? dolores.reduce((a, b) => a + b, 0) / dolores.length
        : null;

      return {
        fecha,
        fechaFormateada: this.formatearFecha(fecha),
        registros: regs,
        totalEjercicios: regs.length,
        promedioDolorValue: promedioDolor,
      };
    });
  }

  private calcularEstadisticas(registros: RegistroEjercicioDirectus[], pacienteId: string) {
    this.isLoadingEstadisticas.set(true);

    try {
      const totalSesiones = new Set(registros.map(r => r.fecha_hora.split('T')[0])).size;

      // Promedio de dolor general
      const dolores = registros.filter(r => r.dolor_escala != null).map(r => r.dolor_escala!);
      const promedioDolorGeneral = dolores.length > 0
        ? Math.round((dolores.reduce((a, b) => a + b, 0) / dolores.length) * 10) / 10
        : null;

      // Días desde última sesión
      let diasDesdeUltimaSesion: number | null = null;
      if (registros.length > 0) {
        const ultimaFecha = new Date(registros[0].fecha_hora);
        const hoy = new Date();
        diasDesdeUltimaSesion = Math.floor((hoy.getTime() - ultimaFecha.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Racha actual (días consecutivos)
      const rachaActual = this.calcularRacha(registros);

      // Adherencia semanal (últimas 4 semanas)
      const adherenciaSemanal = this.calcularAdherenciaSemanal(registros);

      // Adherencia general (simplificado: sesiones con actividad / días del plan)
      const adherenciaGeneral = this.calcularAdherenciaGeneral(registros);

      this.estadisticas.set({
        totalSesiones,
        adherenciaGeneral,
        promedioDolorGeneral,
        diasDesdeUltimaSesion,
        rachaActual,
        adherenciaSemanal,
      });
    } finally {
      this.isLoadingEstadisticas.set(false);
    }
  }

  private calcularRacha(registros: RegistroEjercicioDirectus[]): number {
    if (registros.length === 0) return 0;

    const fechasUnicas = [...new Set(registros.map(r => r.fecha_hora.split('T')[0]))].sort().reverse();
    const hoy = new Date().toISOString().split('T')[0];

    let racha = 0;
    let fechaEsperada = new Date(hoy);

    for (const fecha of fechasUnicas) {
      const fechaReg = new Date(fecha);
      const diffDias = Math.floor((fechaEsperada.getTime() - fechaReg.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDias <= 1) {
        racha++;
        fechaEsperada = fechaReg;
      } else {
        break;
      }
    }

    return racha;
  }

  private calcularAdherenciaSemanal(registros: RegistroEjercicioDirectus[]): { semana: string; porcentaje: number }[] {
    const resultado: { semana: string; porcentaje: number }[] = [];
    const hoy = new Date();

    for (let i = 0; i < 4; i++) {
      const finSemana = new Date(hoy);
      finSemana.setDate(hoy.getDate() - (i * 7));
      const inicioSemana = new Date(finSemana);
      inicioSemana.setDate(finSemana.getDate() - 6);

      const registrosSemana = registros.filter(r => {
        const fecha = new Date(r.fecha_hora);
        return fecha >= inicioSemana && fecha <= finSemana;
      });

      const diasConActividad = new Set(registrosSemana.map(r => r.fecha_hora.split('T')[0])).size;
      const porcentaje = Math.round((diasConActividad / 7) * 100);

      resultado.push({
        semana: `Sem ${4 - i}`,
        porcentaje,
      });
    }

    return resultado.reverse();
  }

  private calcularAdherenciaGeneral(registros: RegistroEjercicioDirectus[]): number {
    if (registros.length === 0) return 0;

    // Últimos 30 días
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const registrosRecientes = registros.filter(r => new Date(r.fecha_hora) >= hace30Dias);
    const diasConActividad = new Set(registrosRecientes.map(r => r.fecha_hora.split('T')[0])).size;

    return Math.round((diasConActividad / 30) * 100);
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

    if (d.toDateString() === hoy.toDateString()) {
      return 'Hoy';
    }
    if (d.toDateString() === ayer.toDateString()) {
      return 'Ayer';
    }

    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== hoy.getFullYear() ? 'numeric' : undefined,
    });
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

  // === Acciones ===

  volver() {
    this.router.navigate(['/mis-pacientes']);
  }

  editarPaciente() {
    const p = this.paciente();
    if (!p) return;

    this.dialog
      .open(AddPacienteDialogComponent, {
        width: '520px',
        data: { clinicIds: this.idsClinicas(), usuario: p },
      })
      .afterClosed()
      .subscribe((r) => {
        if (r?.updated) {
          this.cargarPaciente(p.id);
        }
      });
  }

  abrirQR() {
    const p = this.paciente();
    if (p?.magic_link_url) {
      this.dialog.open(QrDialogComponent, {
        data: { url: p.magic_link_url },
      });
    }
  }

  crearPlan() {
    const p = this.paciente();
    if (p) {
      this.planBuilderService.cambiarPaciente(p);
    }
  }

  verPlan(plan: Plan) {
    this.router.navigate(['/planes', plan.id_plan, 'resumen']);
  }

  editarPlan(plan: Plan) {
    this.router.navigate(['/planes', plan.id_plan, 'editar']);
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
