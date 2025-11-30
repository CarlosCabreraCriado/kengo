import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppService } from '../services/app.service';
import { PlanesService } from '../services/planes.service';
import { RegistroSesionService } from '../services/registro-sesion.service';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import {
  PlanCompleto,
  EjercicioPlan,
  RegistroEjercicio,
  ActividadPlanDia,
  EjercicioPlanConEstado,
} from '../../types/global';

// Tipo extendido para incluir ejercicios en próximos días
interface EjercicioProximo {
  nombre: string;
  portada?: string;
  series: number;
  repeticiones?: number;
  duracion_seg?: number;
  planTitulo: string;
}

interface DiaProximoConEjercicios {
  fecha: Date;
  fechaFormateada: string;
  diaSemana: string;
  totalEjercicios: number;
  planes: { planId: number; titulo: string; ejercicios: number }[];
  ejercicios: EjercicioProximo[];
}

@Component({
  selector: 'app-actividad-diaria',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  templateUrl: './actividad-diaria.component.html',
  styleUrl: './actividad-diaria.component.scss',
})
export class ActividadDiariaComponent implements OnInit {
  private appService = inject(AppService);
  private planesService = inject(PlanesService);
  private registroService = inject(RegistroSesionService);
  private router = inject(Router);

  // Mapeo de días de la semana
  private readonly DIAS_SEMANA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  private readonly NOMBRES_DIAS = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];
  private readonly NOMBRES_MESES = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];

  // Estado
  readonly cargando = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly planesActivos = signal<PlanCompleto[]>([]); // Planes válidos para HOY
  readonly planesActivosYFuturos = signal<PlanCompleto[]>([]); // Todos los planes activos (incluyendo futuros)
  readonly registrosHoy = signal<RegistroEjercicio[]>([]);
  readonly diaExpandido = signal<string | null>(null); // ISO string de la fecha expandida

  // Computed
  readonly usuarioId = computed(() => this.appService.usuario()?.id);
  readonly fechaHoy = computed(() => {
    const hoy = new Date();
    const dia = this.NOMBRES_DIAS[hoy.getDay()];
    const numero = hoy.getDate();
    const mes = this.NOMBRES_MESES[hoy.getMonth()];
    return `${dia}, ${numero} de ${mes}`;
  });

  readonly diaHoy = computed(() => this.DIAS_SEMANA[new Date().getDay()]);

  readonly actividadHoy = computed<ActividadPlanDia[]>(() => {
    const planes = this.planesActivos();
    const registros = this.registrosHoy();
    const hoy = this.diaHoy();

    return planes.map((plan) => {
      // Filtrar ejercicios para hoy
      const ejerciciosHoy = plan.items.filter((item) => {
        if (!item.dias_semana || item.dias_semana.length === 0) {
          return true; // Sin días configurados = todos los días
        }
        return item.dias_semana.includes(hoy);
      });

      // Marcar estado de completado
      const ejerciciosConEstado: EjercicioPlanConEstado[] = ejerciciosHoy.map(
        (ej) => {
          const registrosEjercicio = registros.filter(
            (r) => r.plan_item === ej.id
          );
          const vecesCompletadas = registrosEjercicio.length;
          const vecesRequeridas = ej.veces_dia ?? 1;

          return {
            ...ej,
            completadoHoy: vecesCompletadas >= vecesRequeridas,
            registroId: registrosEjercicio[0]?.id_registro,
            vecesCompletadasHoy: vecesCompletadas,
          };
        }
      );

      const completados = ejerciciosConEstado.filter(
        (e) => e.completadoHoy
      ).length;
      const total = ejerciciosConEstado.length;

      return {
        plan,
        ejerciciosHoy: ejerciciosConEstado,
        totalEjercicios: total,
        completados,
        progreso: total > 0 ? Math.round((completados / total) * 100) : 0,
      };
    });
  });

  readonly hayActividadHoy = computed(() =>
    this.actividadHoy().some((a) => a.ejerciciosHoy.length > 0)
  );

  readonly totalPendientes = computed(() =>
    this.actividadHoy().reduce(
      (acc, a) =>
        acc + a.ejerciciosHoy.filter((e) => !e.completadoHoy).length,
      0
    )
  );

  readonly todoCompletado = computed(
    () => this.hayActividadHoy() && this.totalPendientes() === 0
  );

  readonly proximosDias = computed<DiaProximoConEjercicios[]>(() => {
    // Usar todos los planes activos incluyendo futuros
    const planes = this.planesActivosYFuturos();
    const resultado: DiaProximoConEjercicios[] = [];
    const hoy = new Date();

    // Buscar en los próximos 14 días, encontrar 7 con ejercicios
    for (let i = 1; i <= 14 && resultado.length < 7; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);

      const diaSemana = this.DIAS_SEMANA[fecha.getDay()];
      const planesConEjercicios: {
        planId: number;
        titulo: string;
        ejercicios: number;
      }[] = [];
      const ejerciciosDelDia: EjercicioProximo[] = [];

      let totalEjerciciosDia = 0;

      for (const plan of planes) {
        // Verificar si la fecha está dentro del rango del plan
        if (!this.esFechaEnRangoPlan(plan, fecha)) continue;

        // Obtener ejercicios para este día
        const ejerciciosDia = plan.items.filter((item) => {
          if (!item.dias_semana || item.dias_semana.length === 0) {
            return true;
          }
          return item.dias_semana.includes(diaSemana);
        });

        if (ejerciciosDia.length > 0) {
          planesConEjercicios.push({
            planId: plan.id_plan,
            titulo: plan.titulo,
            ejercicios: ejerciciosDia.length,
          });
          totalEjerciciosDia += ejerciciosDia.length;

          // Agregar ejercicios detallados
          for (const ej of ejerciciosDia) {
            ejerciciosDelDia.push({
              nombre: ej.ejercicio.nombre_ejercicio,
              portada: ej.ejercicio.portada,
              series: ej.series ?? 3,
              repeticiones: ej.repeticiones,
              duracion_seg: ej.duracion_seg,
              planTitulo: plan.titulo,
            });
          }
        }
      }

      if (totalEjerciciosDia > 0) {
        resultado.push({
          fecha,
          fechaFormateada: this.formatearFecha(fecha),
          diaSemana: this.NOMBRES_DIAS[fecha.getDay()],
          totalEjercicios: totalEjerciciosDia,
          planes: planesConEjercicios,
          ejercicios: ejerciciosDelDia,
        });
      }
    }

    return resultado;
  });

  readonly sinPlanesActivos = computed(
    () => !this.cargando() &&
         this.planesActivos().length === 0 &&
         this.planesActivosYFuturos().length === 0
  );

  ngOnInit(): void {
    this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {
    const userId = this.usuarioId();
    if (!userId) {
      this.error.set('No se pudo identificar al usuario');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    try {
      const [planesHoy, planesFuturos, registros] = await Promise.all([
        this.planesService.getPlanesActivosPaciente(userId),
        this.planesService.getPlanesActivosYFuturosPaciente(userId),
        this.registroService.obtenerRegistrosHoy(userId),
      ]);

      this.planesActivos.set(planesHoy);
      this.planesActivosYFuturos.set(planesFuturos);
      this.registrosHoy.set(registros);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      this.error.set('Error al cargar la actividad. Intenta de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  irAPlan(planId: number): void {
    this.router.navigate(['/mi-plan', planId]);
  }

  volverInicio(): void {
    this.router.navigate(['/inicio']);
  }

  toggleDia(fecha: Date): void {
    const fechaStr = fecha.toISOString();
    if (this.diaExpandido() === fechaStr) {
      this.diaExpandido.set(null);
    } else {
      this.diaExpandido.set(fechaStr);
    }
  }

  esDiaExpandido(fecha: Date): boolean {
    return this.diaExpandido() === fecha.toISOString();
  }

  getAssetUrl(id?: string, width = 80, height = 80): string {
    return this.planesService.getAssetUrl(id, width, height);
  }

  // Helpers privados

  private esFechaEnRangoPlan(plan: PlanCompleto, fecha: Date): boolean {
    const fechaStr = fecha.toISOString().split('T')[0];

    if (plan.fecha_inicio && fechaStr < plan.fecha_inicio) {
      return false;
    }
    if (plan.fecha_fin && fechaStr > plan.fecha_fin) {
      return false;
    }

    return true;
  }

  private formatearFecha(fecha: Date): string {
    const dia = fecha.getDate();
    const mes = this.NOMBRES_MESES[fecha.getMonth()].substring(0, 3);
    return `${dia} ${mes}`;
  }
}
