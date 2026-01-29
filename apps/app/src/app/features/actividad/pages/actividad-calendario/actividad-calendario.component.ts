import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanesService } from '../../../planes/data-access/planes.service';
import { RegistroSesionService } from '../../../sesion/data-access/registro-sesion.service';
import { ActividadHoyService } from '../../data-access/actividad-hoy.service';

import {
  PlanCompleto,
  EjercicioPlan,
  EjercicioSesionMultiPlan,
  ConfigSesionMultiPlan,
  DiaSemana,
} from '../../../../../types/global';

interface EjercicioCalendario {
  nombre: string;
  portada?: string;
  series: number;
  repeticiones?: number;
  duracion_seg?: number;
  planTitulo: string;
  planId: number;
  planItemId: number;
}

interface DiaCalendario {
  fecha: Date;
  diaNumero: number;
  esHoy: boolean;
  esMesActual: boolean;
  tieneActividad: boolean;
  totalEjercicios: number;
  planes: { planId: number; titulo: string; ejercicios: number }[];
  ejercicios: EjercicioCalendario[];
}

interface DiaProximoConEjercicios {
  fecha: Date;
  fechaFormateada: string;
  diaSemana: string;
  totalEjercicios: number;
  planes: { planId: number; titulo: string; ejercicios: number }[];
  ejercicios: EjercicioCalendario[];
}

@Component({
  selector: 'app-actividad-calendario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './actividad-calendario.component.html',
  styleUrl: './actividad-calendario.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full',
  },
})
export class ActividadCalendarioComponent implements OnInit {
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private registroService = inject(RegistroSesionService);
  private actividadHoyService = inject(ActividadHoyService);
  private router = inject(Router);

  private readonly DIAS_SEMANA: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  private readonly NOMBRES_DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
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
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  readonly cargando = this.actividadHoyService.cargando;
  readonly error = signal<string | null>(null);
  readonly planesActivosYFuturos = signal<PlanCompleto[]>([]);
  readonly mesActual = signal<Date>(new Date());
  readonly diaSeleccionado = signal<DiaCalendario | null>(null);

  readonly usuarioId = computed(() => this.sessionService.usuario()?.id);

  readonly tituloMes = computed(() => {
    const fecha = this.mesActual();
    return `${this.NOMBRES_MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
  });

  readonly diasSemanaHeaders = this.NOMBRES_DIAS_CORTOS;

  readonly diasCalendario = computed<DiaCalendario[]>(() => {
    const planes = this.planesActivosYFuturos();
    const mesActual = this.mesActual();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const primerDiaMes = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);
    const ultimoDiaMes = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0);

    // Calcular el día de inicio (lunes de la semana del primer día)
    const diaInicio = new Date(primerDiaMes);
    const diaSemanaInicio = diaInicio.getDay();
    // Convertir de domingo=0 a lunes=0
    const offset = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1;
    diaInicio.setDate(diaInicio.getDate() - offset);

    // Calcular el día final (domingo de la semana del último día)
    const diaFin = new Date(ultimoDiaMes);
    const diaSemanaFin = diaFin.getDay();
    const offsetFin = diaSemanaFin === 0 ? 0 : 7 - diaSemanaFin;
    diaFin.setDate(diaFin.getDate() + offsetFin);

    const dias: DiaCalendario[] = [];
    const fechaIterador = new Date(diaInicio);

    while (fechaIterador <= diaFin) {
      const fecha = new Date(fechaIterador);
      const diaSemana = this.DIAS_SEMANA[fecha.getDay()];
      const esMesActual = fecha.getMonth() === mesActual.getMonth();
      const esHoy = fecha.getTime() === hoy.getTime();

      const { ejercicios, planes: planesDelDia } = this.obtenerEjerciciosDia(planes, fecha, diaSemana);

      dias.push({
        fecha,
        diaNumero: fecha.getDate(),
        esHoy,
        esMesActual,
        tieneActividad: ejercicios.length > 0,
        totalEjercicios: ejercicios.length,
        planes: planesDelDia,
        ejercicios,
      });

      fechaIterador.setDate(fechaIterador.getDate() + 1);
    }

    return dias;
  });

  readonly proximosDias = computed<DiaProximoConEjercicios[]>(() => {
    const planes = this.planesActivosYFuturos();
    const resultado: DiaProximoConEjercicios[] = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (let i = 1; i <= 14 && resultado.length < 5; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);

      const diaSemana = this.DIAS_SEMANA[fecha.getDay()];
      const { ejercicios, planes: planesDelDia } = this.obtenerEjerciciosDia(planes, fecha, diaSemana);

      if (ejercicios.length > 0) {
        resultado.push({
          fecha,
          fechaFormateada: this.formatearFechaCorta(fecha),
          diaSemana: this.NOMBRES_DIAS[fecha.getDay()],
          totalEjercicios: ejercicios.length,
          planes: planesDelDia,
          ejercicios,
        });
      }
    }

    return resultado;
  });

  readonly sinPlanesActivos = computed(
    () => !this.cargando() && this.planesActivosYFuturos().length === 0
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
        this.cargarPlanes(userId),
      ]);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      this.error.set('Error al cargar el calendario. Intenta de nuevo.');
    }
  }

  private async cargarPlanes(userId: string): Promise<void> {
    const planes = await this.planesService.getPlanesActivosYFuturosPaciente(userId);
    this.planesActivosYFuturos.set(planes);
  }

  mesAnterior(): void {
    const fecha = new Date(this.mesActual());
    fecha.setMonth(fecha.getMonth() - 1);
    this.mesActual.set(fecha);
    this.diaSeleccionado.set(null);
  }

  mesSiguiente(): void {
    const fecha = new Date(this.mesActual());
    fecha.setMonth(fecha.getMonth() + 1);
    this.mesActual.set(fecha);
    this.diaSeleccionado.set(null);
  }

  seleccionarDia(dia: DiaCalendario): void {
    if (this.diaSeleccionado()?.fecha.getTime() === dia.fecha.getTime()) {
      this.diaSeleccionado.set(null);
    } else {
      this.diaSeleccionado.set(dia);
    }
  }

  esDiaSeleccionado(dia: DiaCalendario): boolean {
    const seleccionado = this.diaSeleccionado();
    return seleccionado?.fecha.getTime() === dia.fecha.getTime();
  }

  getAssetUrl(id?: string, width = 80, height = 80): string {
    return this.planesService.getAssetUrl(id, width, height);
  }

  iniciarSesionDia(dia: DiaCalendario | DiaProximoConEjercicios): void {
    if (dia.ejercicios.length === 0) return;

    const ejercicios: EjercicioSesionMultiPlan[] = [];

    for (const ej of dia.ejercicios) {
      const planItem = this.obtenerEjercicioPlanItem(ej);
      if (planItem) {
        ejercicios.push({
          ...planItem,
          planId: ej.planId,
          planTitulo: ej.planTitulo,
          planItemId: ej.planItemId,
        });
      }
    }

    if (ejercicios.length === 0) return;

    const diaSemana = 'diaSemana' in dia
      ? dia.diaSemana
      : this.NOMBRES_DIAS[dia.fecha.getDay()];

    const config: ConfigSesionMultiPlan = {
      titulo: `Ejercicios del ${diaSemana}`,
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

  formatearFechaSeleccionada(): string {
    const dia = this.diaSeleccionado();
    if (!dia) return '';

    const nombreDia = this.NOMBRES_DIAS[dia.fecha.getDay()];
    const numero = dia.fecha.getDate();
    const mes = this.NOMBRES_MESES[dia.fecha.getMonth()];
    return `${nombreDia} ${numero} de ${mes}`;
  }

  private obtenerEjerciciosDia(
    planes: PlanCompleto[],
    fecha: Date,
    diaSemana: DiaSemana
  ): { ejercicios: EjercicioCalendario[]; planes: { planId: number; titulo: string; ejercicios: number }[] } {
    const ejercicios: EjercicioCalendario[] = [];
    const planesConEjercicios: { planId: number; titulo: string; ejercicios: number }[] = [];

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

        for (const ej of ejerciciosDia) {
          ejercicios.push({
            nombre: ej.ejercicio.nombre_ejercicio,
            portada: ej.ejercicio.portada,
            series: ej.series ?? 3,
            repeticiones: ej.repeticiones,
            duracion_seg: ej.duracion_seg,
            planTitulo: plan.titulo,
            planId: plan.id_plan,
            planItemId: ej.id!,
          });
        }
      }
    }

    return { ejercicios, planes: planesConEjercicios };
  }

  private obtenerEjercicioPlanItem(ej: EjercicioCalendario): EjercicioPlan | null {
    const planes = this.planesActivosYFuturos();
    for (const plan of planes) {
      const item = plan.items.find((i) => i.id === ej.planItemId);
      if (item) {
        return item;
      }
    }
    return null;
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

  private formatearFechaCorta(fecha: Date): string {
    const dia = fecha.getDate();
    const mes = this.NOMBRES_MESES[fecha.getMonth()].substring(0, 3).toLowerCase();
    return `${dia} ${mes}`;
  }
}
