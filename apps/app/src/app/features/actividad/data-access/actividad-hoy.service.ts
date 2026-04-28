import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { PlanesService } from '../../planes/data-access/planes.service';
import { SesionStateService } from '../../sesion/data-access/sesion-state.service';
import {
  PlanCompleto,
  RegistroEjercicio,
  ActividadPlanDia,
  EjercicioPlanConEstado,
  DiaSemana,
} from '../../../../types/global';

export type BadgeType = 'pending' | 'completed' | 'rest' | 'loading' | null;

export type EjercicioUnificadoHoy = EjercicioPlanConEstado & {
  planId: string;
  planTitulo: string;
};

@Injectable({ providedIn: 'root' })
export class ActividadHoyService {
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private registroService = inject(SesionStateService);

  // Mapeo de días de la semana
  private readonly DIAS_SEMANA: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  // Estado interno
  readonly cargando = signal<boolean>(false);
  readonly planesActivos = signal<PlanCompleto[]>([]);
  readonly registrosHoy = signal<RegistroEjercicio[]>([]);
  private datosCargados = signal<boolean>(false);

  constructor() {
    // Effect que carga automáticamente cuando el usuario está disponible
    effect(() => {
      const usuario = this.sessionService.usuario();

      // Cargar automáticamente cuando el usuario esté disponible
      if (usuario?.id && !this.datosCargados() && !this.cargando()) {
        this.ejecutarCarga(usuario.id);
      }
    });
  }

  // Computed: día actual
  private readonly diaHoy = computed(() => this.DIAS_SEMANA[new Date().getDay()]);

  // Computed: actividad del día con estado de completado
  readonly actividadHoy = computed<ActividadPlanDia[]>(() => {
    const planes = this.planesActivos();
    const registros = this.registrosHoy();
    const hoy = this.diaHoy();

    return planes.map((plan) => {
      // Filtrar ejercicios para hoy
      const ejerciciosHoy = plan.items.filter((item) => {
        if (!item.diasSemana || item.diasSemana.length === 0) {
          return true; // Sin días configurados = todos los días
        }
        return item.diasSemana.includes(hoy);
      });

      // Marcar estado de completado
      const ejerciciosConEstado: EjercicioPlanConEstado[] = ejerciciosHoy.map(
        (ej) => {
          const registrosEjercicio = registros.filter(
            (r) => r.planItemId === ej.id
          );
          const vecesCompletadas = registrosEjercicio.length;
          const vecesRequeridas = ej.vecesDia ?? 1;

          return {
            ...ej,
            completadoHoy: vecesCompletadas >= vecesRequeridas,
            registroId: registrosEjercicio[0]?.id,
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

  readonly ejerciciosUnificadosHoy = computed<EjercicioUnificadoHoy[]>(() => {
    const actividades = this.actividadHoy();
    const out: EjercicioUnificadoHoy[] = [];
    for (const a of actividades) {
      for (const ej of a.ejerciciosHoy) {
        out.push({ ...ej, planId: a.plan.id, planTitulo: a.plan.titulo });
      }
    }
    return out;
  });

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

  readonly sinPlanesActivos = computed(
    () => !this.cargando() && this.planesActivos().length === 0
  );

  // === COMPUTED PARA EL CAROUSEL ===

  readonly subtituloDinamico = computed<string>(() => {
    if (this.cargando()) return 'Cargando...';
    if (this.sinPlanesActivos()) return 'Sin planes activos';
    if (!this.hayActividadHoy()) return 'Hoy es día de descanso';
    if (this.todoCompletado()) return '¡Todo completado!';
    const n = this.totalPendientes();
    return n === 1 ? 'Tienes 1 ejercicio pendiente' : `Tienes ${n} ejercicios pendientes`;
  });

  readonly badgeType = computed<BadgeType>(() => {
    if (this.cargando()) return 'loading';
    if (this.sinPlanesActivos() || !this.hayActividadHoy()) return 'rest';
    if (this.todoCompletado()) return 'completed';
    return 'pending';
  });

  readonly badgeCount = computed<number>(() => {
    if (this.badgeType() === 'pending') return this.totalPendientes();
    return 0;
  });

  // Progreso total del día (completados / total)
  readonly progresoTotal = computed(() => {
    const actividad = this.actividadHoy();
    const total = actividad.reduce((acc, a) => acc + a.totalEjercicios, 0);
    const completados = actividad.reduce((acc, a) => acc + a.completados, 0);
    return { completados, total };
  });

  // Total de series del día
  readonly totalSeriesHoy = computed(() => {
    const actividad = this.actividadHoy();
    return actividad.reduce(
      (acc, a) =>
        acc + a.ejerciciosHoy.reduce((sum, ej) => sum + (ej.series ?? 3), 0),
      0
    );
  });

  // Tiempo estimado de la sesión del día
  readonly tiempoEstimadoHoy = computed(() => {
    const actividad = this.actividadHoy();
    let totalSegundos = 0;

    for (const plan of actividad) {
      for (const item of plan.ejerciciosHoy) {
        const series = item.series ?? 3;
        const descanso = item.descansoSeg ?? 60;

        if (item.duracionSeg) {
          totalSegundos += item.duracionSeg * series;
        } else {
          const reps = item.repeticiones ?? 12;
          totalSegundos += reps * 3 * series;
        }

        totalSegundos += descanso * (series - 1);
      }
    }

    const minutos = Math.round(totalSegundos / 60);
    if (minutos < 60) {
      return `${minutos} min`;
    }
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return mins > 0 ? `${horas}h ${mins}m` : `${horas}h`;
  });

  // Nombre del primer ejercicio pendiente
  readonly primerEjercicioPendiente = computed<string | null>(() => {
    const actividad = this.actividadHoy();
    for (const plan of actividad) {
      const pendiente = plan.ejerciciosHoy.find((e) => !e.completadoHoy);
      if (pendiente) {
        return pendiente.ejercicio?.nombre ?? 'Ejercicio';
      }
    }
    return null;
  });

  // === MÉTODOS ===

  /**
   * Solicita la carga de datos de actividad del día.
   * Normalmente no es necesario llamar a este método manualmente,
   * ya que el effect carga automáticamente cuando el usuario está disponible.
   */
  async cargarDatos(): Promise<void> {
    if (this.datosCargados() || this.cargando()) return;

    const userId = this.sessionService.usuario()?.id;
    if (userId) {
      await this.ejecutarCarga(userId);
    }
  }

  /**
   * Ejecuta la carga real de datos
   */
  private async ejecutarCarga(userId: string): Promise<void> {
    if (this.datosCargados() || this.cargando()) return;

    this.cargando.set(true);
    try {
      const [planes, registros] = await Promise.all([
        this.planesService.getPlanesActivosPaciente(userId),
        this.registroService.obtenerRegistrosHoy(userId),
      ]);
      this.planesActivos.set(planes);
      this.registrosHoy.set(registros);
      this.datosCargados.set(true);
    } catch (err) {
      console.error('Error al cargar actividad de hoy:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Fuerza la recarga de datos
   */
  async recargar(): Promise<void> {
    const userId = this.sessionService.usuario()?.id;
    if (!userId) return;

    this.datosCargados.set(false);
    await this.ejecutarCarga(userId);
  }

  /**
   * Actualiza los registros de hoy (útil después de completar un ejercicio)
   */
  async actualizarRegistros(): Promise<void> {
    const userId = this.sessionService.usuario()?.id;
    if (!userId) return;

    try {
      const registros = await this.registroService.obtenerRegistrosHoy(userId);
      this.registrosHoy.set(registros);
    } catch (err) {
      console.error('Error al actualizar registros:', err);
    }
  }
}
