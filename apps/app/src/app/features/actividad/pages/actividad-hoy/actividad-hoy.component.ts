import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanesService } from '../../../planes/data-access/planes.service';
import { RegistroSesionService } from '../../../sesion/data-access/registro-sesion.service';
import { ActividadHoyService } from '../../data-access/actividad-hoy.service';

import {
  PlanCompleto,
  EjercicioSesionMultiPlan,
  ConfigSesionMultiPlan,
  DiaSemana,
} from '../../../../../types/global';
import { KENGO_BREAKPOINTS } from '../../../../shared';

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
  selector: 'app-actividad-hoy',
  standalone: true,
  imports: [],
  templateUrl: './actividad-hoy.component.html',
  styleUrl: './actividad-hoy.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full',
  },
})
export class ActividadHoyComponent implements OnInit {
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private registroService = inject(RegistroSesionService);
  private actividadHoyService = inject(ActividadHoyService);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);

  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((result) => result.matches)),
    { initialValue: true }
  );

  private readonly DIAS_SEMANA: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
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

  readonly cargando = this.actividadHoyService.cargando;
  readonly error = signal<string | null>(null);
  readonly planesActivos = this.actividadHoyService.planesActivos;
  readonly planesActivosYFuturos = signal<PlanCompleto[]>([]);
  readonly registrosHoy = this.actividadHoyService.registrosHoy;
  readonly diaExpandido = signal<string | null>(null);

  readonly usuarioId = computed(() => this.sessionService.usuario()?.id);
  readonly fechaHoy = computed(() => {
    const hoy = new Date();
    const dia = this.NOMBRES_DIAS[hoy.getDay()];
    const numero = hoy.getDate();
    const mes = this.NOMBRES_MESES[hoy.getMonth()];
    return `${dia}, ${numero} de ${mes}`;
  });

  readonly diaHoy = computed(() => this.DIAS_SEMANA[new Date().getDay()]);

  readonly actividadHoy = this.actividadHoyService.actividadHoy;
  readonly hayActividadHoy = this.actividadHoyService.hayActividadHoy;
  readonly totalPendientes = this.actividadHoyService.totalPendientes;
  readonly todoCompletado = this.actividadHoyService.todoCompletado;
  readonly progresoTotal = this.actividadHoyService.progresoTotal;

  readonly proximosDias = computed<DiaProximoConEjercicios[]>(() => {
    const planes = this.planesActivosYFuturos();
    const resultado: DiaProximoConEjercicios[] = [];
    const hoy = new Date();

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
        if (!this.esFechaEnRangoPlan(plan, fecha)) continue;

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
      return;
    }

    this.error.set(null);

    try {
      await Promise.all([
        this.actividadHoyService.cargarDatos(),
        this.cargarPlanesFuturos(userId),
      ]);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      this.error.set('Error al cargar la actividad. Intenta de nuevo.');
    }
  }

  private async cargarPlanesFuturos(userId: string): Promise<void> {
    const planesFuturos = await this.planesService.getPlanesActivosYFuturosPaciente(userId);
    this.planesActivosYFuturos.set(planesFuturos);
  }

  irAPlan(planId: number): void {
    this.router.navigate(['/mi-plan', planId]);
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

  iniciarSesionHoy(): void {
    const actividades = this.actividadHoy();

    const ejercicios: EjercicioSesionMultiPlan[] = [];
    const planesInvolucrados: {
      planId: number;
      titulo: string;
      cantidadEjercicios: number;
    }[] = [];

    for (const actividad of actividades) {
      if (actividad.ejerciciosHoy.length === 0) continue;

      planesInvolucrados.push({
        planId: actividad.plan.id_plan,
        titulo: actividad.plan.titulo,
        cantidadEjercicios: actividad.ejerciciosHoy.length,
      });

      for (const ej of actividad.ejerciciosHoy) {
        ejercicios.push({
          ...ej,
          planId: actividad.plan.id_plan,
          planTitulo: actividad.plan.titulo,
          planItemId: ej.id!,
        });
      }
    }

    if (ejercicios.length === 0) return;

    const config: ConfigSesionMultiPlan = {
      titulo: 'Tu actividad de hoy',
      fecha: new Date(),
      esFechaProgramada: true,
      ejercicios,
      planesInvolucrados,
    };

    this.registroService.iniciarSesionMultiPlan(config);
    this.router.navigate(['/mi-plan']);
  }

  iniciarSesionDia(dia: DiaProximoConEjercicios): void {
    const ejercicios: EjercicioSesionMultiPlan[] = [];
    const planes = this.planesActivosYFuturos();
    const diaSemana = this.DIAS_SEMANA[dia.fecha.getDay()];

    for (const plan of planes) {
      if (!this.esFechaEnRangoPlan(plan, dia.fecha)) continue;

      const ejerciciosDia = plan.items.filter((item) => {
        if (!item.dias_semana || item.dias_semana.length === 0) return true;
        return item.dias_semana.includes(diaSemana);
      });

      for (const ej of ejerciciosDia) {
        ejercicios.push({
          ...ej,
          planId: plan.id_plan,
          planTitulo: plan.titulo,
          planItemId: ej.id!,
        });
      }
    }

    if (ejercicios.length === 0) return;

    const config: ConfigSesionMultiPlan = {
      titulo: `Ejercicios del ${dia.diaSemana}`,
      fecha: dia.fecha,
      esFechaProgramada: false,
      ejercicios,
      planesInvolucrados: dia.planes.map((p) => ({
        planId: p.planId,
        titulo: p.titulo,
        cantidadEjercicios: p.ejercicios,
      })),
    };

    this.registroService.iniciarSesionMultiPlan(config);
    this.router.navigate(['/mi-plan']);
  }

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
