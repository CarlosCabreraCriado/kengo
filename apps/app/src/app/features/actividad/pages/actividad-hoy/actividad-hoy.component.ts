import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { videoUrl } from '../../../../core/utils/asset-url';
import { Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanesService } from '../../../planes/data-access/planes.service';
import { SesionStateService } from '../../../sesion/data-access/sesion-state.service';
import { ActividadHoyService } from '../../data-access/actividad-hoy.service';
import { PageLoaderService } from '../../../../core/services/page-loader.service';

import {
  PlanCompleto,
  EjercicioSesionMultiPlan,
  ConfigSesionMultiPlan,
} from '../../../../../types/global';
import {
  diaSemanaFromYMD,
  getMadridDate,
  getMadridDiaSemana,
  offsetMadridDate,
  ymdToDateForDisplay,
} from '../../../../shared/utils/madrid-date.util';
import {
  useResponsive,
  DialogService,
  PreviewEjercicioDialogComponent,
  type PreviewEjercicioData,
} from '../../../../shared';
import type { EjercicioPlanConEstado } from '../../../../../types/global';
import {
  Ui2BigTitleComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2CtaBarComponent,
  Ui2EmptyStateComponent,
  Ui2PillComponent,
  Ui2SectionComponent,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';

interface EjercicioProximo {
  nombre: string;
  portada?: string;
  series: number;
  repeticiones?: number;
  duracionSeg?: number;
  planTitulo: string;
}

interface DiaProximoConEjercicios {
  fecha: Date;
  fechaFormateada: string;
  diaSemana: string;
  totalEjercicios: number;
  planes: { planId: string; titulo: string; ejercicios: number }[];
  ejercicios: EjercicioProximo[];
}

@Component({
  selector: 'app-actividad-hoy',
  standalone: true,
  imports: [
    NgOptimizedImage,
    Ui2BigTitleComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2CtaBarComponent,
    Ui2EmptyStateComponent,
    Ui2PillComponent,
    Ui2SectionComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './actividad-hoy.component.html',
  styleUrl: './actividad-hoy.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full',
  },
})
export class ActividadHoyComponent implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private registroService = inject(SesionStateService);
  private actividadHoyService = inject(ActividadHoyService);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private pageLoader = inject(PageLoaderService);
  private readonly PAGE_LOADER_KEY = 'actividad-hoy';

  /** Datos críticos: actividad de hoy resuelta. */
  readonly pageReady = computed(
    () =>
      this.sessionService.usuario() != null &&
      this.actividadHoyService.cargada(),
  );

  isMovil = useResponsive().esMobile;

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
    const hoy = ymdToDateForDisplay(getMadridDate());
    const dia = this.NOMBRES_DIAS[hoy.getUTCDay()];
    const numero = hoy.getUTCDate();
    const mes = this.NOMBRES_MESES[hoy.getUTCMonth()];
    return `${dia}, ${numero} de ${mes}`;
  });

  readonly diaHoy = computed(() => getMadridDiaSemana());

  readonly actividadHoy = this.actividadHoyService.actividadHoy;
  readonly hayActividadHoy = this.actividadHoyService.hayActividadHoy;
  readonly totalPendientes = this.actividadHoyService.totalPendientes;
  readonly todoCompletado = this.actividadHoyService.todoCompletado;
  readonly progresoTotal = this.actividadHoyService.progresoTotal;
  readonly totalSeriesHoy = this.actividadHoyService.totalSeriesHoy;
  readonly tiempoEstimadoHoy = this.actividadHoyService.tiempoEstimadoHoy;
  readonly ejerciciosUnificadosHoy = this.actividadHoyService.ejerciciosUnificadosHoy;

  readonly proximosDias = computed<DiaProximoConEjercicios[]>(() => {
    const planes = this.planesActivosYFuturos();
    const resultado: DiaProximoConEjercicios[] = [];

    for (let i = 1; i <= 14 && resultado.length < 7; i++) {
      const fechaYMD = offsetMadridDate(i);
      const diaSemana = diaSemanaFromYMD(fechaYMD);
      const fecha = ymdToDateForDisplay(fechaYMD);

      const planesConEjercicios: {
        planId: string;
        titulo: string;
        ejercicios: number;
      }[] = [];
      const ejerciciosDelDia: EjercicioProximo[] = [];

      let totalEjerciciosDia = 0;

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
          totalEjerciciosDia += ejerciciosDia.length;

          for (const ej of ejerciciosDia) {
            ejerciciosDelDia.push({
              nombre: ej.ejercicio.nombre,
              portada: ej.ejercicio.portada,
              series: ej.series ?? 3,
              repeticiones: ej.repeticiones,
              duracionSeg: ej.duracionSeg,
              planTitulo: plan.titulo,
            });
          }
        }
      }

      if (totalEjerciciosDia > 0) {
        resultado.push({
          fecha,
          fechaFormateada: this.formatearFecha(fecha),
          diaSemana: this.NOMBRES_DIAS[fecha.getUTCDay()],
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
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
  }

  async cargarDatos(): Promise<void> {
    const userId = this.usuarioId();
    if (!userId) {
      this.error.set('No se pudo identificar al usuario');
      return;
    }

    this.error.set(null);

    try {
      await this.cargarPlanesFuturos(userId);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      this.error.set('Error al cargar la actividad. Intenta de nuevo.');
    }
  }

  private async cargarPlanesFuturos(userId: string): Promise<void> {
    const planesFuturos = await this.planesService.getPlanesActivosYFuturosPaciente(userId);
    this.planesActivosYFuturos.set(planesFuturos);
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

  async iniciarSesionHoy(): Promise<void> {
    const actividades = this.actividadHoy();

    const ejercicios: EjercicioSesionMultiPlan[] = [];
    const planesInvolucrados: {
      planId: string;
      titulo: string;
      cantidadEjercicios: number;
    }[] = [];

    for (const actividad of actividades) {
      if (actividad.ejerciciosHoy.length === 0) continue;

      planesInvolucrados.push({
        planId: actividad.plan.id,
        titulo: actividad.plan.titulo,
        cantidadEjercicios: actividad.ejerciciosHoy.length,
      });

      for (const ej of actividad.ejerciciosHoy) {
        ejercicios.push({
          ...ej,
          planId: actividad.plan.id,
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
      skipResumen: true,
    };

    await this.registroService.iniciarSesionMultiPlan(config);
    this.router.navigate(['/mi-plan']);
  }

  async iniciarSesionDia(dia: DiaProximoConEjercicios): Promise<void> {
    const ejercicios: EjercicioSesionMultiPlan[] = [];
    const planes = this.planesActivosYFuturos();
    // `dia.fecha` se construyó a 12:00 UTC con `ymdToDateForDisplay`, así que
    // formatearla en Madrid devuelve siempre el mismo YYYY-MM-DD.
    const fechaYMD = getMadridDate(dia.fecha);
    const diaSemana = diaSemanaFromYMD(fechaYMD);

    for (const plan of planes) {
      if (!this.esFechaEnRangoPlan(plan, fechaYMD)) continue;

      const ejerciciosDia = plan.items.filter((item) => {
        if (!item.diasSemana || item.diasSemana.length === 0) return true;
        return item.diasSemana.includes(diaSemana);
      });

      for (const ej of ejerciciosDia) {
        ejercicios.push({
          ...ej,
          planId: plan.id,
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
      skipResumen: true,
    };

    await this.registroService.iniciarSesionMultiPlan(config);
    this.router.navigate(['/mi-plan']);
  }

  /**
   * Comprueba si una fecha (en formato YYYY-MM-DD calendario Madrid) cae
   * dentro del intervalo de vigencia del plan. `plan.fechaInicio` y
   * `plan.fechaFin` también son YYYY-MM-DD Madrid, así que la comparación
   * lexicográfica de strings funciona.
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

  private formatearFecha(fecha: Date): string {
    const dia = fecha.getUTCDate();
    const mes = this.NOMBRES_MESES[fecha.getUTCMonth()].substring(0, 3);
    return `${dia} ${mes}`;
  }

  onPreviewEjercicio(ejercicio: EjercicioPlanConEstado, index: number): void {
    const ej = ejercicio.ejercicio;
    const data: PreviewEjercicioData = {
      ejercicio,
      index,
      totalEjercicios: this.ejerciciosUnificadosHoy().length,
      videoUrl: ej.video ? videoUrl(ej.video) : null,
      posterUrl: ej.portada ? this.getAssetUrl(ej.portada, 800, 450) : null,
      estado: ejercicio.completadoHoy ? 'completado' : 'pendiente',
    };

    this.dialogService.open(PreviewEjercicioDialogComponent, {
      data,
      maxWidth: '420px',
      maxHeight: '85vh',
    });
  }
}
