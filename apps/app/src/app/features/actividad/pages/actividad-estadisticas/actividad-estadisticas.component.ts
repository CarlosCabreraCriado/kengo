import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanesService } from '../../../planes/data-access/planes.service';
import { ActividadHoyService } from '../../data-access/actividad-hoy.service';
import { environment as env } from '../../../../../environments/environment';
import { RegistroEjercicio, DiaSemana } from '../../../../../types/global';

interface RegistroEjercicioDirectus {
  id_registro: number;
  plan_item: number | { id: number };
  paciente: string | { id: string };
  fecha_hora: string;
  completado: boolean;
  repeticiones_realizadas?: number;
  duracion_real_seg?: number;
  dolor_escala?: number;
  nota_paciente?: string;
}

interface RegistrosResponse {
  data: RegistroEjercicioDirectus[];
}

interface DiaEstadistica {
  diaSemana: string;
  diaCorto: string;
  fecha: Date;
  ejerciciosCompletados: number;
  tieneActividad: boolean;
}

interface EjercicioReciente {
  nombre: string;
  portada?: string;
  fechaHora: Date;
  tiempoRelativo: string;
}

@Component({
  selector: 'app-actividad-estadisticas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './actividad-estadisticas.component.html',
  styleUrl: './actividad-estadisticas.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full',
  },
})
export class ActividadEstadisticasComponent implements OnInit {
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private actividadHoyService = inject(ActividadHoyService);

  private readonly DIAS_SEMANA: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  private readonly DIAS_CORTOS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  private readonly NOMBRES_DIAS = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];

  readonly cargando = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly registrosSemana = signal<RegistroEjercicio[]>([]);
  readonly registrosMes = signal<RegistroEjercicio[]>([]);

  readonly usuarioId = computed(() => this.sessionService.usuario()?.id);

  // Estadísticas semanales
  readonly estadisticasSemana = computed<DiaEstadistica[]>(() => {
    const registros = this.registrosSemana();
    const hoy = new Date();
    const diasSemana: DiaEstadistica[] = [];

    // Calcular el lunes de esta semana
    const diaSemanaHoy = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (diaSemanaHoy === 0 ? 6 : diaSemanaHoy - 1));
    lunes.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const fecha = new Date(lunes);
      fecha.setDate(lunes.getDate() + i);

      // Contar registros de este día
      const registrosDia = registros.filter((r) => {
        const fechaRegistro = new Date(r.fecha_hora);
        return (
          fechaRegistro.getDate() === fecha.getDate() &&
          fechaRegistro.getMonth() === fecha.getMonth() &&
          fechaRegistro.getFullYear() === fecha.getFullYear()
        );
      });

      diasSemana.push({
        diaSemana: this.NOMBRES_DIAS[fecha.getDay()],
        diaCorto: this.DIAS_CORTOS[fecha.getDay()],
        fecha,
        ejerciciosCompletados: registrosDia.length,
        tieneActividad: registrosDia.length > 0,
      });
    }

    return diasSemana;
  });

  readonly totalEjerciciosSemana = computed(() =>
    this.estadisticasSemana().reduce((acc, d) => acc + d.ejerciciosCompletados, 0)
  );

  readonly diasConActividadSemana = computed(() =>
    this.estadisticasSemana().filter((d) => d.tieneActividad).length
  );

  readonly maxEjerciciosDia = computed(() =>
    Math.max(...this.estadisticasSemana().map((d) => d.ejerciciosCompletados), 1)
  );

  // Racha actual
  readonly rachaActual = computed(() => {
    const estadisticas = this.estadisticasSemana();
    let racha = 0;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Buscar hacia atrás desde hoy
    for (let i = estadisticas.length - 1; i >= 0; i--) {
      const dia = estadisticas[i];
      if (dia.fecha > hoy) continue;

      if (dia.tieneActividad) {
        racha++;
      } else if (dia.fecha.getTime() < hoy.getTime()) {
        break;
      }
    }

    return racha;
  });

  // Progreso mensual
  readonly progresoMensual = computed(() => {
    const registros = this.registrosMes();
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const diasTranscurridos = Math.ceil(
      (hoy.getTime() - primerDiaMes.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    // Contar días únicos con actividad
    const diasUnicos = new Set<string>();
    registros.forEach((r) => {
      const fecha = new Date(r.fecha_hora);
      diasUnicos.add(`${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`);
    });

    const diasConActividad = diasUnicos.size;
    const porcentaje = diasTranscurridos > 0
      ? Math.round((diasConActividad / diasTranscurridos) * 100)
      : 0;

    return {
      diasConActividad,
      diasTranscurridos,
      porcentaje,
      totalEjercicios: registros.length,
    };
  });

  // Ejercicios recientes
  readonly ejerciciosRecientes = computed<EjercicioReciente[]>(() => {
    const registros = this.registrosSemana();
    const planes = this.actividadHoyService.planesActivos();

    // Obtener los últimos 5 registros
    const ultimos = registros
      .sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime())
      .slice(0, 5);

    return ultimos.map((registro) => {
      // Buscar el nombre del ejercicio
      let nombre = 'Ejercicio';
      let portada: string | undefined;

      for (const plan of planes) {
        const item = plan.items.find((i) => i.id === registro.plan_item);
        if (item) {
          nombre = item.ejercicio.nombre_ejercicio;
          portada = item.ejercicio.portada;
          break;
        }
      }

      const fechaHora = new Date(registro.fecha_hora);
      return {
        nombre,
        portada,
        fechaHora,
        tiempoRelativo: this.calcularTiempoRelativo(fechaHora),
      };
    });
  });

  readonly sinDatos = computed(
    () => !this.cargando() &&
         this.registrosSemana().length === 0 &&
         this.registrosMes().length === 0
  );

  ngOnInit(): void {
    this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {
    const userId = this.usuarioId();
    if (!userId) {
      this.error.set('No se pudo identificar al usuario');
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    try {
      await Promise.all([
        this.actividadHoyService.cargarDatos(),
        this.cargarRegistrosSemana(userId),
        this.cargarRegistrosMes(userId),
      ]);
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
      this.error.set('Error al cargar las estadísticas. Intenta de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarRegistrosSemana(userId: string): Promise<void> {
    const hoy = new Date();
    const diaSemanaHoy = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (diaSemanaHoy === 0 ? 6 : diaSemanaHoy - 1));
    lunes.setHours(0, 0, 0, 0);

    const registros = await this.obtenerRegistrosDesde(userId, lunes);
    this.registrosSemana.set(registros);
  }

  private async cargarRegistrosMes(userId: string): Promise<void> {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const registros = await this.obtenerRegistrosDesde(userId, primerDiaMes);
    this.registrosMes.set(registros);
  }

  private async obtenerRegistrosDesde(
    pacienteId: string,
    desde: Date
  ): Promise<RegistroEjercicio[]> {
    const filter = {
      _and: [
        { paciente: { _eq: pacienteId } },
        { fecha_hora: { _gte: desde.toISOString() } },
        { completado: { _eq: true } },
      ],
    };

    try {
      const response = await firstValueFrom(
        this.http.get<RegistrosResponse>(
          `${env.DIRECTUS_URL}/items/planes_registros`,
          {
            params: {
              filter: JSON.stringify(filter),
              sort: '-fecha_hora',
            },
            withCredentials: true,
          }
        )
      );

      return (response?.data || []).map((r) => this.transformRegistro(r));
    } catch (error) {
      console.error('Error al obtener registros:', error);
      return [];
    }
  }

  private transformRegistro(r: RegistroEjercicioDirectus): RegistroEjercicio {
    return {
      id_registro: r.id_registro,
      plan_item: typeof r.plan_item === 'object' ? r.plan_item.id : r.plan_item,
      paciente: typeof r.paciente === 'object' ? r.paciente.id : r.paciente,
      fecha_hora: r.fecha_hora,
      completado: r.completado,
      repeticiones_realizadas: r.repeticiones_realizadas,
      duracion_real_seg: r.duracion_real_seg,
      dolor_escala: r.dolor_escala,
      nota_paciente: r.nota_paciente,
    };
  }

  private calcularTiempoRelativo(fecha: Date): string {
    const ahora = new Date();
    const diff = ahora.getTime() - fecha.getTime();
    const minutos = Math.floor(diff / (1000 * 60));
    const horas = Math.floor(diff / (1000 * 60 * 60));
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutos < 60) {
      return minutos <= 1 ? 'Hace un momento' : `Hace ${minutos} min`;
    } else if (horas < 24) {
      return horas === 1 ? 'Hace 1 hora' : `Hace ${horas} horas`;
    } else if (dias === 1) {
      return 'Ayer';
    } else if (dias < 7) {
      return `Hace ${dias} días`;
    } else {
      return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
  }

  getAssetUrl(id?: string, width = 80, height = 80): string {
    return this.planesService.getAssetUrl(id, width, height);
  }

  getBarHeight(ejercicios: number): number {
    const max = this.maxEjerciciosDia();
    return max > 0 ? (ejercicios / max) * 100 : 0;
  }

  esHoy(fecha: Date): boolean {
    const hoy = new Date();
    return (
      fecha.getDate() === hoy.getDate() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getFullYear() === hoy.getFullYear()
    );
  }
}
