import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanesService } from '../../../planes/data-access/planes.service';
import { SesionStateService } from '../../../sesion/data-access/sesion-state.service';
import { ActividadHoyService } from '../../data-access/actividad-hoy.service';

import {
  PlanCompleto,
  EjercicioPlan,
  EjercicioSesionMultiPlan,
  ConfigSesionMultiPlan,
  DiaSemana,
} from '../../../../../types/global';
import {
  diaSemanaFromYMD,
  getMadridDate,
  ymdToDateForDisplay,
} from '../../../../shared/utils/madrid-date.util';

import {
  Ui2BigTitleComponent,
  Ui2CardComponent,
  Ui2CtaBarComponent,
  Ui2EmptyStateComponent,
  Ui2IconBadgeComponent,
  Ui2PillComponent,
  Ui2SectionComponent,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';

interface EjercicioCalendario {
  nombre: string;
  portada?: string;
  series: number;
  repeticiones?: number;
  duracionSeg?: number;
  planTitulo: string;
  planId: string;
  planItemId: string;
}

interface DiaCalendario {
  fecha: Date;
  diaNumero: number;
  esHoy: boolean;
  esMesActual: boolean;
  tieneActividad: boolean;
  totalEjercicios: number;
  planes: { planId: string; titulo: string; ejercicios: number }[];
  ejercicios: EjercicioCalendario[];
}

@Component({
  selector: 'app-patient-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2BigTitleComponent,
    Ui2CardComponent,
    Ui2CtaBarComponent,
    Ui2EmptyStateComponent,
    Ui2IconBadgeComponent,
    Ui2PillComponent,
    Ui2SectionComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './patient-calendar.component.html',
  styleUrl: './patient-calendar.component.css',
})
export class PatientCalendarComponent implements OnInit {
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private registroService = inject(SesionStateService);
  private actividadHoyService = inject(ActividadHoyService);
  private router = inject(Router);

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
  // `mesActual` siempre es un Date a 12:00 UTC (Madrid-safe). Lecturas con
  // `getUTC*`, mutaciones con `setUTC*`.
  readonly mesActual = signal<Date>(ymdToDateForDisplay(getMadridDate()));
  readonly diaSeleccionado = signal<DiaCalendario | null>(null);

  readonly usuarioId = computed(() => this.sessionService.usuario()?.id);

  readonly tituloMes = computed(() => {
    const fecha = this.mesActual();
    return `${this.NOMBRES_MESES[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`;
  });

  readonly fechaHoy = computed(() => {
    const hoy = ymdToDateForDisplay(getMadridDate());
    const dia = this.NOMBRES_DIAS[hoy.getUTCDay()];
    const numero = hoy.getUTCDate();
    const mes = this.NOMBRES_MESES[hoy.getUTCMonth()].toLowerCase();
    return `${dia}, ${numero} de ${mes}`;
  });

  readonly diasSemanaHeaders = this.NOMBRES_DIAS_CORTOS;

  readonly diasCalendario = computed<DiaCalendario[]>(() => {
    const planes = this.planesActivosYFuturos();
    const mesActual = this.mesActual();
    // Hoy en calendario Madrid, materializado a 12:00 UTC. Comparamos con
    // `getTime()` porque todos los Date del calendario se construyen igual.
    const hoyDate = ymdToDateForDisplay(getMadridDate());
    const hoyTime = hoyDate.getTime();

    const year = mesActual.getUTCFullYear();
    const month = mesActual.getUTCMonth();

    // Primer y último día del mes a 12:00 UTC.
    const primerDiaMes = new Date(Date.UTC(year, month, 1, 12));
    const ultimoDiaMes = new Date(Date.UTC(year, month + 1, 0, 12));

    // Lunes que precede al primer día del mes (puede caer en mes anterior).
    const diaInicio = new Date(primerDiaMes);
    const dowPrimer = diaInicio.getUTCDay();
    const offset = dowPrimer === 0 ? 6 : dowPrimer - 1;
    diaInicio.setUTCDate(diaInicio.getUTCDate() - offset);

    // Domingo que sigue al último día del mes.
    const diaFin = new Date(ultimoDiaMes);
    const dowUltimo = diaFin.getUTCDay();
    const offsetFin = dowUltimo === 0 ? 0 : 7 - dowUltimo;
    diaFin.setUTCDate(diaFin.getUTCDate() + offsetFin);

    const dias: DiaCalendario[] = [];
    const fechaIterador = new Date(diaInicio);

    while (fechaIterador <= diaFin) {
      const fecha = new Date(fechaIterador);
      // Como `fecha` está a 12:00 UTC, `toISOString().slice(0, 10)`
      // devuelve el mismo YYYY-MM-DD que representa.
      const fechaYMD = fecha.toISOString().slice(0, 10);
      const diaSemana = diaSemanaFromYMD(fechaYMD);
      const esMesActual = fecha.getUTCMonth() === month;
      const esHoy = fecha.getTime() === hoyTime;

      const { ejercicios, planes: planesDelDia } = this.obtenerEjerciciosDia(
        planes,
        fechaYMD,
        diaSemana,
      );

      dias.push({
        fecha,
        diaNumero: fecha.getUTCDate(),
        esHoy,
        esMesActual,
        tieneActividad: ejercicios.length > 0,
        totalEjercicios: ejercicios.length,
        planes: planesDelDia,
        ejercicios,
      });

      fechaIterador.setUTCDate(fechaIterador.getUTCDate() + 1);
    }

    return dias;
  });

  readonly sinPlanesActivos = computed(
    () => !this.cargando() && this.planesActivosYFuturos().length === 0
  );

  private inicializado = false;

  constructor() {
    effect(() => {
      const dias = this.diasCalendario();
      if (dias.length === 0) return;

      const actual = untracked(() => this.diaSeleccionado());

      if (actual) {
        const equiv = dias.find(
          (d) => d.fecha.getTime() === actual.fecha.getTime()
        );
        if (equiv && equiv !== actual) {
          this.diaSeleccionado.set(equiv);
        }
        return;
      }

      if (!this.inicializado) {
        const hoy = dias.find((d) => d.esHoy && d.esMesActual);
        if (hoy) {
          this.diaSeleccionado.set(hoy);
          this.inicializado = true;
        }
      }
    });
  }

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
    fecha.setUTCMonth(fecha.getUTCMonth() - 1);
    this.mesActual.set(fecha);
    this.diaSeleccionado.set(null);
  }

  mesSiguiente(): void {
    const fecha = new Date(this.mesActual());
    fecha.setUTCMonth(fecha.getUTCMonth() + 1);
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

  iniciarSesionDia(dia: DiaCalendario): void {
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

    const diaSemana = this.NOMBRES_DIAS[dia.fecha.getUTCDay()];

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
      skipResumen: true,
    };

    this.registroService.iniciarSesionMultiPlan(config);
    this.router.navigate(['/mi-plan']);
  }

  formatearFechaSeleccionada(): string {
    const dia = this.diaSeleccionado();
    if (!dia) return '';

    const nombreDia = this.NOMBRES_DIAS[dia.fecha.getUTCDay()];
    const numero = dia.fecha.getUTCDate();
    const mes = this.NOMBRES_MESES[dia.fecha.getUTCMonth()];
    return `${nombreDia} ${numero} de ${mes}`;
  }

  private obtenerEjerciciosDia(
    planes: PlanCompleto[],
    fechaYMD: string,
    diaSemana: DiaSemana
  ): { ejercicios: EjercicioCalendario[]; planes: { planId: string; titulo: string; ejercicios: number }[] } {
    const ejercicios: EjercicioCalendario[] = [];
    const planesConEjercicios: { planId: string; titulo: string; ejercicios: number }[] = [];

    for (const plan of planes) {
      if (!this.esFechaEnRangoPlan(plan, fechaYMD)) continue;

      const ejerciciosDia = plan.items.filter((item) => {
        if (!item.diasSemana || item.diasSemana.length === 0) {
          return true;
        }
        return item.diasSemana.includes(diaSemana);
      });

      if (ejerciciosDia.length > 0) {
        planesConEjercicios.push({
          planId: plan.id,
          titulo: plan.titulo,
          ejercicios: ejerciciosDia.length,
        });

        for (const ej of ejerciciosDia) {
          ejercicios.push({
            nombre: ej.ejercicio.nombre,
            portada: ej.ejercicio.portada,
            series: ej.series ?? 3,
            repeticiones: ej.repeticiones,
            duracionSeg: ej.duracionSeg,
            planTitulo: plan.titulo,
            planId: plan.id,
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

  /**
   * Comprueba si una fecha YYYY-MM-DD (calendario Madrid) cae dentro del
   * intervalo de vigencia del plan. `plan.fechaInicio`/`fechaFin` también
   * son YYYY-MM-DD Madrid → comparación lexicográfica equivalente al
   * orden calendario.
   */
  private esFechaEnRangoPlan(plan: PlanCompleto, fechaYMD: string): boolean {
    if (plan.fechaInicio && fechaYMD < plan.fechaInicio) {
      return false;
    }
    if (plan.fechaFin && fechaYMD > plan.fechaFin) {
      return false;
    }

    return true;
  }
}
