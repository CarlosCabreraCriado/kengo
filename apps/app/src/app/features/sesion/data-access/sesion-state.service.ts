import {
  Injectable,
  computed,
  inject,
  signal,
  effect,
} from '@angular/core';
import { assetUrl, videoUrl } from '../../../core/utils/asset-url';
import { SessionService } from '../../../core/auth/services/session.service';
import { PlanesService } from '../../planes/data-access/planes.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import { SesionPersistenceService } from './sesion-persistence.service';
import { SesionTemporizadorService } from './sesion-temporizador.service';

import {
  PlanCompleto,
  EjercicioPlan,
  EstadoPantalla,
  RegistroEjercicio,
  SesionLocal,
  FeedbackEjercicio,
  EjercicioSesionMultiPlan,
  ConfigSesionMultiPlan,
  DiaSemana,
} from '../../../../types/global';

@Injectable({ providedIn: 'root' })
export class SesionStateService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private persistencia = inject(SesionPersistenceService);
  private temporizador = inject(SesionTemporizadorService);

  // ========= Estado de la sesión =========

  readonly planActivo = signal<PlanCompleto | null>(null);
  readonly ejercicioActualIndex = signal<number>(0);
  readonly serieActual = signal<number>(1);
  readonly estadoPantalla = signal<EstadoPantalla>('resumen');
  readonly registrosSesion = signal<RegistroEjercicio[]>([]);
  readonly tiempoInicioSesion = signal<Date | null>(null);
  readonly feedbackActual = signal<FeedbackEjercicio | null>(null);
  readonly sesionActualId = signal<string | null>(null);

  // Estado del temporizador (proxies del SesionTemporizadorService)
  readonly tiempoRestante = this.temporizador.tiempoRestante;
  readonly temporizadorActivo = this.temporizador.temporizadorActivo;
  readonly descansoEntreEjercicios = this.temporizador.descansoEntreEjercicios;

  // ========= Estado Multi-Plan =========
  readonly modoMultiPlan = signal<boolean>(false);
  readonly configSesion = signal<ConfigSesionMultiPlan | null>(null);
  readonly ejerciciosMultiPlan = signal<EjercicioSesionMultiPlan[]>([]);

  // ========= Computed =========

  readonly tituloSesion = computed(() => {
    if (this.modoMultiPlan()) {
      return this.configSesion()?.titulo ?? 'Tu sesion';
    }
    return this.planActivo()?.titulo ?? 'Tu sesion';
  });

  readonly ejerciciosList = computed<EjercicioPlan[]>(() => {
    if (this.modoMultiPlan()) {
      return this.ejerciciosMultiPlan();
    }
    return this.planActivo()?.items ?? [];
  });

  readonly ejercicioActual = computed<EjercicioPlan | null>(() => {
    const lista = this.ejerciciosList();
    const idx = this.ejercicioActualIndex();
    return lista[idx] ?? null;
  });

  readonly totalEjercicios = computed(() => this.ejerciciosList().length);

  readonly totalSeries = computed(() => this.ejercicioActual()?.series ?? 1);

  readonly progresoEjercicio = computed(() => {
    const serie = this.serieActual();
    const total = this.totalSeries();
    return total > 0 ? ((serie - 1) / total) * 100 : 0;
  });

  readonly progresoSesion = computed(() => {
    const total = this.totalEjercicios();
    const completados = this.ejercicioActualIndex();
    return total > 0 ? (completados / total) * 100 : 0;
  });

  readonly esUltimaSerie = computed(() => this.serieActual() >= this.totalSeries());

  readonly esUltimoEjercicio = computed(() => {
    const total = this.totalEjercicios();
    return this.ejercicioActualIndex() >= total - 1;
  });

  readonly proximoEjercicio = computed<EjercicioPlan | null>(() => {
    const lista = this.ejerciciosList();
    const idx = this.ejercicioActualIndex();
    return lista[idx + 1] ?? null;
  });

  readonly esTipoTemporizador = computed(() => {
    const ej = this.ejercicioActual();
    return ej?.duracionSeg !== undefined && ej.duracionSeg > 0;
  });

  readonly tiempoTranscurrido = computed(() => {
    const inicio = this.tiempoInicioSesion();
    if (!inicio) return 0;
    return Math.floor((Date.now() - inicio.getTime()) / 1000);
  });

  readonly usuarioId = computed(() => this.sessionService.usuario()?.id ?? null);

  constructor() {
    // Auto-guardar progreso cuando cambia el estado
    effect(() => {
      const plan = this.planActivo();
      const estado = this.estadoPantalla();
      if (plan && estado !== 'resumen' && estado !== 'feedback-final') {
        this.guardarProgresoLocal();
      }
    });
  }

  // ========= Métodos principales =========

  /**
   * Cargar el plan activo del paciente actual
   */
  async cargarPlanPaciente(): Promise<PlanCompleto | null> {
    const userId = this.usuarioId();
    if (!userId) return null;

    try {
      const planes = await this.planesService.getPlanesByPaciente(userId);
      const planActivo = planes.find((p) => p.estado === 'activo');

      if (!planActivo) return null;

      const planCompleto = await this.planesService.getPlanById(planActivo.id);
      if (planCompleto) {
        this.planActivo.set(planCompleto);
      }

      return planCompleto;
    } catch (error) {
      console.error('Error al cargar plan del paciente:', error);
      return null;
    }
  }

  /**
   * Iniciar una sesión con un plan específico
   */
  async iniciarSesion(planId?: string): Promise<boolean> {
    try {
      if (this.restaurarProgresoLocal()) {
        return true;
      }

      let plan: PlanCompleto | null = null;

      if (planId) {
        plan = await this.planesService.getPlanById(planId);
      } else {
        plan = await this.cargarPlanPaciente();
      }

      if (!plan || !plan.items?.length) {
        return false;
      }

      const ejerciciosHoy = this.filtrarEjerciciosHoy(plan.items);

      this.planActivo.set({
        ...plan,
        items: ejerciciosHoy.length > 0 ? ejerciciosHoy : plan.items,
      });
      this.ejercicioActualIndex.set(0);
      this.serieActual.set(1);
      this.estadoPantalla.set('resumen');
      this.registrosSesion.set([]);
      this.tiempoInicioSesion.set(null);

      return true;
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      return false;
    }
  }

  /**
   * Iniciar una sesion con ejercicios de multiples planes
   */
  iniciarSesionMultiPlan(config: ConfigSesionMultiPlan): boolean {
    try {
      this.resetearEstado();

      this.modoMultiPlan.set(true);
      this.configSesion.set(config);
      this.ejerciciosMultiPlan.set(config.ejercicios);

      this.ejercicioActualIndex.set(0);
      this.serieActual.set(1);
      this.estadoPantalla.set('resumen');
      this.registrosSesion.set([]);
      this.tiempoInicioSesion.set(null);

      return true;
    } catch (error) {
      console.error('Error al iniciar sesion multi-plan:', error);
      return false;
    }
  }

  /**
   * Comenzar la sesión (desde resumen a primer ejercicio)
   */
  async comenzarSesion(): Promise<void> {
    const ahora = new Date();
    this.tiempoInicioSesion.set(ahora);
    this.estadoPantalla.set('ejercicio');
    this.serieActual.set(1);

    await this.crearSesionRemota(ahora);

    this.guardarProgresoLocal();
  }

  /**
   * Completar la serie actual
   */
  completarSerie(): void {
    const ejercicio = this.ejercicioActual();
    if (!ejercicio) return;

    const serieActual = this.serieActual();
    const totalSeries = this.totalSeries();
    const descanso = ejercicio.descansoSeg ?? 45;

    if (serieActual < totalSeries) {
      // Hay más series: ir a descanso entre series
      this.serieActual.update((s) => s + 1);
      this.temporizador.iniciarDescanso(descanso, false);
      this.estadoPantalla.set('descanso');
    } else {
      // Última serie del ejercicio: registrar y descanso antes del siguiente
      this.registrarEjercicioCompletado();

      if (this.esUltimoEjercicio()) {
        this.avanzarEjercicio();
      } else {
        this.temporizador.iniciarDescanso(descanso, true);
        this.estadoPantalla.set('descanso');
      }
    }

    this.guardarProgresoLocal();
  }

  /**
   * Saltar el descanso y continuar
   */
  saltarDescanso(): void {
    const eraEntreEjercicios = this.temporizador.descansoEntreEjercicios();
    this.temporizador.detener();

    if (eraEntreEjercicios) {
      this.temporizador.descansoEntreEjercicios.set(false);
      this.avanzarEjercicio();
    } else {
      this.estadoPantalla.set('ejercicio');
    }
    this.guardarProgresoLocal();
  }

  /**
   * Añadir tiempo al descanso
   */
  agregarTiempoDescanso(segundos = 15): void {
    this.temporizador.agregarTiempo(segundos);
  }

  /**
   * Cuando termina el descanso automáticamente
   */
  finalizarDescanso(): void {
    if (this.temporizador.descansoEntreEjercicios()) {
      this.temporizador.descansoEntreEjercicios.set(false);
      this.avanzarEjercicio();
    } else {
      this.estadoPantalla.set('ejercicio');
    }
    this.guardarProgresoLocal();
  }

  /**
   * Registrar ejercicio completado (sin dolor, se agrega al final)
   */
  registrarEjercicioCompletado(): void {
    const ejercicio = this.ejercicioActual();
    const userId = this.usuarioId();

    if (!ejercicio?.id || !userId) return;

    const planItemId = this.modoMultiPlan()
      ? (ejercicio as EjercicioSesionMultiPlan).planItemId
      : ejercicio.id;

    const registro: RegistroEjercicio = {
      planItemId: planItemId,
      pacienteId: userId,
      fechaHora: new Date().toISOString(),
      completado: true,
      repeticionesRealizadas: ejercicio.repeticiones,
      duracionRealSeg: ejercicio.duracionSeg,
    };

    this.registrosSesion.update((regs) => [...regs, registro]);
  }

  /**
   * Aplicar feedback final de todos los ejercicios y guardar
   */
  async aplicarFeedbackFinal(data: {
    feedbacks: { planItemId: string; dolor: number; nota?: string }[];
    observacionesGenerales?: string;
  }): Promise<void> {
    this.registrosSesion.update((regs) =>
      regs.map((reg) => {
        const feedback = data.feedbacks.find((f) => f.planItemId === reg.planItemId);
        if (feedback) {
          return {
            ...reg,
            dolorEscala: feedback.dolor,
            notaPaciente: feedback.nota,
          };
        }
        return reg;
      })
    );

    // Guardar registros: createBatch agenda en Convex el recálculo de cumplimiento
    // y la generación de notificaciones vía ctx.scheduler.runAfter.
    await this.guardarRegistrosRemotos();

    // Finalizar sesión: complete agenda notificaciones si hay observaciones.
    await this.cerrarSesionRemota(data.observacionesGenerales);

    this.limpiarProgresoLocal();
  }

  /**
   * Avanzar al siguiente ejercicio
   */
  avanzarEjercicio(): void {
    if (this.esUltimoEjercicio()) {
      this.estadoPantalla.set('feedback-final');
    } else {
      this.ejercicioActualIndex.update((i) => i + 1);
      this.serieActual.set(1);
      this.estadoPantalla.set('ejercicio');
    }

    this.guardarProgresoLocal();
  }

  /**
   * Pausar la sesión y volver al resumen
   */
  pausarSesion(): void {
    this.guardarProgresoLocal();
    this.estadoPantalla.set('resumen');
  }

  /**
   * Finalizar la sesión
   */
  async finalizarSesion(): Promise<boolean> {
    try {
      await this.guardarRegistrosRemotos();
      this.limpiarProgresoLocal();
      this.resetearEstado();
      return true;
    } catch (error) {
      console.error('Error al finalizar sesión:', error);
      return false;
    }
  }

  /**
   * Resetear todo el estado
   */
  resetearEstado(): void {
    this.planActivo.set(null);
    this.modoMultiPlan.set(false);
    this.configSesion.set(null);
    this.ejerciciosMultiPlan.set([]);
    this.ejercicioActualIndex.set(0);
    this.serieActual.set(1);
    this.estadoPantalla.set('resumen');
    this.registrosSesion.set([]);
    this.tiempoInicioSesion.set(null);
    this.feedbackActual.set(null);
    this.temporizador.reset();
    this.sesionActualId.set(null);
  }

  // ========= Persistencia local (delegada a SesionPersistenceService) =========

  guardarProgresoLocal(): void {
    const plan = this.planActivo();
    if (!plan) return;

    const data: SesionLocal = {
      planId: plan.id,
      ejercicioIndex: this.ejercicioActualIndex(),
      serieActual: this.serieActual(),
      estado: this.estadoPantalla(),
      registrosPendientes: this.registrosSesion(),
      timestamp: new Date().toISOString(),
    };

    this.persistencia.guardar(data);
  }

  restaurarProgresoLocal(): boolean {
    const data = this.persistencia.restaurar();
    if (!data) return false;

    this.planesService.getPlanById(data.planId).then((plan) => {
      if (plan) {
        this.planActivo.set(plan);
        this.ejercicioActualIndex.set(data.ejercicioIndex);
        this.serieActual.set(data.serieActual);
        this.estadoPantalla.set(data.estado);
        this.registrosSesion.set(data.registrosPendientes);
      }
    });

    return true;
  }

  limpiarProgresoLocal(): void {
    this.persistencia.limpiar();
  }

  // ========= Persistencia remota (Convex) =========

  /**
   * Crear una sesión remota al comenzar (Convex mutation sessions.create)
   */
  private async crearSesionRemota(fechaInicio: Date): Promise<string | null> {
    try {
      const sessionId = await this.convex.mutation(
        api.sessions.mutations.create,
        { fechaInicio: fechaInicio.toISOString() },
      );

      if (sessionId) {
        this.sesionActualId.set(sessionId as string);
      }
      return sessionId as string;
    } catch (error) {
      console.error('Error al crear sesión:', error);
      return null;
    }
  }

  /**
   * Cerrar la sesión remota con observaciones (Convex mutation sessions.complete)
   */
  private async cerrarSesionRemota(
    observacionesGenerales?: string
  ): Promise<boolean> {
    const sesionId = this.sesionActualId();
    if (!sesionId) return false;

    try {
      await this.convex.mutation(api.sessions.mutations.complete, {
        sessionId: sesionId as any,
        fechaFin: new Date().toISOString(),
        observacionesGenerales: observacionesGenerales || undefined,
      });
      return true;
    } catch (error) {
      console.error('Error al finalizar sesión:', error);
      return false;
    }
  }

  /**
   * Crear un registro de ejercicio. Modelo nuevo (Fase 5):
   * `executions.mutations.create` escribe directamente en `exerciseExecutions`
   * y gestiona sesión, agregados y alertas de comentario.
   */
  async crearRegistro(
    registro: Omit<RegistroEjercicio, 'id'>
  ): Promise<string | null> {
    try {
      const id = await this.convex.mutation(api.executions.mutations.create, {
        planExerciseId: this.resolvePlanExerciseId(registro.planItemId) as any,
        fechaHora: registro.fechaHora,
        fecha: registro.fechaHora.split('T')[0]!,
        completado: registro.completado,
        repeticionesRealizadas: registro.repeticionesRealizadas,
        duracionRealSeg: registro.duracionRealSeg,
        dolorEscala: registro.dolorEscala,
        esfuerzoEscala: registro.esfuerzoEscala,
        notaPaciente: registro.notaPaciente,
      });
      return id as string;
    } catch (error) {
      console.error('Error al crear registro:', error);
      return null;
    }
  }

  /**
   * Guardar batch de registros pendientes. Modelo nuevo (Fase 5):
   * `executions.mutations.createBatch` escribe directo a `exerciseExecutions`
   * y gestiona sesión + recompute + alertas de forma optimizada (1 recompute
   * por sesión afectada).
   */
  async guardarRegistrosRemotos(): Promise<boolean> {
    const registros = this.registrosSesion();
    if (registros.length === 0) return true;

    try {
      await this.convex.mutation(api.executions.mutations.createBatch, {
        entradas: registros.map((reg) => ({
          planExerciseId: this.resolvePlanExerciseId(reg.planItemId) as any,
          fechaHora: reg.fechaHora,
          fecha: reg.fechaHora.split('T')[0]!,
          completado: reg.completado,
          repeticionesRealizadas: reg.repeticionesRealizadas,
          duracionRealSeg: reg.duracionRealSeg,
          dolorEscala: reg.dolorEscala,
          esfuerzoEscala: reg.esfuerzoEscala,
          notaPaciente: reg.notaPaciente,
        })),
      });

      return true;
    } catch (error) {
      console.error('Error al guardar registros:', error);
      return false;
    }
  }

  /**
   * Obtener registros del paciente de hoy
   */
  async obtenerRegistrosHoy(pacienteId: string): Promise<RegistroEjercicio[]> {
    const hoy = new Date().toISOString().split('T')[0]!;

    try {
      const convexUserId = this.resolveUserConvexId(pacienteId);
      const raw = await this.convex.query(
        api.executions.queries.listByPacienteAndDate,
        {
          pacienteId: convexUserId as any,
          fecha: hoy,
        },
      );

      return ((raw as any[]) || []).map((r) => this.mapConvexToRegistro(r));
    } catch (error) {
      console.error('Error al obtener registros de hoy:', error);
      return [];
    }
  }

  // ========= Helpers =========

  private filtrarEjerciciosHoy(items: EjercicioPlan[]): EjercicioPlan[] {
    const diasSemana: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const hoy = diasSemana[new Date().getDay()];

    return items.filter((item) => {
      if (!item.diasSemana || item.diasSemana.length === 0) {
        return true;
      }
      return item.diasSemana.includes(hoy);
    });
  }

  private mapConvexToRegistro(r: any): RegistroEjercicio {
    return {
      id: r._id,
      planItemId: r.planExerciseId,
      pacienteId: r.pacienteId,
      fechaHora: r.fechaHora,
      completado: r.completado,
      repeticionesRealizadas: r.repeticionesRealizadas,
      duracionRealSeg: r.duracionRealSeg,
      dolorEscala: r.dolorEscala,
      esfuerzoEscala: r.esfuerzoEscala,
      notaPaciente: r.notaPaciente,
    };
  }

  private resolvePlanExerciseId(planItem: any): string {
    if (typeof planItem === 'string' && planItem.length > 20) return planItem;
    if (typeof planItem === 'object' && planItem?._convexId) return planItem._convexId;
    if (typeof planItem === 'number' || typeof planItem === 'string') {
      const items = this.planActivo()?.items ?? [];
      const found = items.find((i: any) => i.id === planItem || i._convexId === planItem);
      if (found && (found as any)._convexId) return (found as any)._convexId;
    }
    throw new Error(`No se pudo resolver planExerciseId: ${planItem}`);
  }

  private resolveUserConvexId(userId: string): string | undefined {
    const currentUser = this.sessionService.usuario();
    if (currentUser?.id === userId && currentUser.convexId) {
      return currentUser.convexId;
    }
    if (userId.length > 20) return userId;
    return undefined;
  }

  // ========= Helper de assets =========
  getAssetUrl(id?: string, width = 400, height = 300) {
    return id
      ? assetUrl(id, { width, height, fit: 'cover', format: 'webp' })
      : '';
  }

  getVideoUrl(id?: string) {
    return id ? videoUrl(id) : '';
  }
}
