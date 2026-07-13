import {
  Injectable,
  computed,
  inject,
  signal,
  effect,
} from '@angular/core';
import { assetUrl, videoUrl } from '../../../core/utils/asset-url';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { PlanesService } from '../../planes/data-access/planes.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { LoggerService } from '../../../core/services/logger.service';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { SesionPersistenceService } from './sesion-persistence.service';
import { SesionTemporizadorService } from './sesion-temporizador.service';
import {
  getMadridDate,
  getMadridDiaSemana,
} from '../../../shared/utils/madrid-date.util';
import {
  ConvexExecutionRecord,
  mapConvexToRegistro,
} from '../../../shared/utils/convex-mappers';

import {
  PlanCompleto,
  EjercicioPlan,
  EstadoPantalla,
  RegistroEjercicio,
  FeedbackEjercicio,
  EjercicioSesionMultiPlan,
  ConfigSesionMultiPlan,
} from '../../../../types/global';

interface PendingExecutionPayload {
  planExerciseId: Id<'planExercises'>;
  fechaHora: string;
  fecha: string;
  completado: boolean;
  repeticionesRealizadas?: number;
  duracionRealSeg?: number;
}

/** Forma del execution expandido devuelto por
 *  `sessions.queries.getByPacienteAndDateWithExecutions`. */
interface ExecutionRehidratable {
  _id: Id<'exerciseExecutions'>;
  fechaHora: string;
  completado: boolean;
  repeticionesRealizadas?: number;
  duracionRealSeg?: number;
  dolorEscala?: number;
  esfuerzoEscala?: number;
  notaPaciente?: string;
  planExercise?: { _id: Id<'planExercises'> } | null;
}

/** Forma de cada sesión devuelta por la query de rehidratación. */
interface SesionRehidratable {
  _id: Id<'sessions'>;
  fecha: string;
  fechaInicio: string;
  fechaFin?: string;
  estado: 'en_curso' | 'completada' | 'completada_parcial';
  executions: ExecutionRehidratable[];
}

interface PendingExecution {
  payload: PendingExecutionPayload;
  registroBase: Omit<RegistroEjercicio, 'executionId' | 'id'>;
}

@Injectable({ providedIn: 'root' })
export class SesionStateService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private planesService = inject(PlanesService);
  private persistencia = inject(SesionPersistenceService);
  private temporizador = inject(SesionTemporizadorService);
  private logger = inject(LoggerService);

  // Cola en memoria para reintentar inserts de executions que fallaron
  // por red. Se drena en `aplicarFeedbackFinal` y `finalizarSesion`.
  private pendingExecutions: PendingExecution[] = [];

  // Guards anti-duplicados: ejercicios con insert en vuelo y flag de drain
  // en curso (aplicarFeedbackFinal y finalizarSesion pueden solaparse).
  private inFlightPlanExerciseIds = new Set<string>();
  private draining = false;

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

  /**
   * La sesión en curso es "extra": el paciente eligió hacer ejercicios no
   * programados hoy (día de descanso). Solo afecta al copy de la UI — el
   * backend infiere los extras por su cuenta y no cuentan para la
   * completitud del día.
   */
  readonly sesionEsExtra = signal<boolean>(false);

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
    const items = this.planActivo()?.items ?? [];
    return items.map((item) => ({
      ...item,
      planItemId: item.planItemId ?? item.id ?? String(item.sort),
    }));
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
    // Auto-guardar el hint de UI mientras la sesión está activa.
    effect(() => {
      const sessionId = this.sesionActualId();
      const estado = this.estadoPantalla();
      if (sessionId && estado !== 'resumen' && estado !== 'feedback-final') {
        this.guardarHintUI();
      }
    });
  }

  // ========= Métodos principales =========

  /**
   * Cargar el plan activo del paciente actual. Con varios planes activos la
   * elección es determinista: solo planes vigentes hoy, ordenados por mayor
   * `version` y `fechaInicio` más reciente (antes se cogía el primero que
   * devolviera el listado, con resultados arbitrarios).
   */
  async cargarPlanPaciente(): Promise<PlanCompleto | null> {
    const userId = this.usuarioId();
    if (!userId) return null;

    try {
      const hoy = getMadridDate();
      const planes = (await this.planesService.getPlanesByPaciente(userId))
        .filter(
          (p) =>
            p.estado === 'activo' &&
            (!p.fechaInicio || p.fechaInicio <= hoy) &&
            (!p.fechaFin || p.fechaFin >= hoy),
        )
        .sort(
          (a, b) =>
            (b.version ?? 1) - (a.version ?? 1) ||
            (b.fechaInicio ?? '').localeCompare(a.fechaInicio ?? ''),
        );
      const planActivo = planes[0];

      if (!planActivo) return null;

      const planCompleto = await this.planesService.getPlanById(planActivo.id);
      if (planCompleto) {
        this.planActivo.set(planCompleto);
      }

      return planCompleto;
    } catch (error) {
      this.logger.error('Error al cargar plan del paciente:', error);
      return null;
    }
  }

  /**
   * Iniciar una sesión con un plan específico. Convex es la primera fuente
   * de reanudación: si existe sesión `en_curso` para hoy, se rehidratan los
   * registros desde sus executions y se aplica el hint de UI (si coincide).
   *
   * Si hoy no hay ejercicios programados del plan, devuelve `'descanso'` y
   * NO carga ejercicios (antes hacía fallback silencioso a TODO el plan, lo
   * que permitía completar "la sesión" con ejercicios de otros días). El
   * caller puede relanzar con `{ extra: true }` si el paciente elige
   * explícitamente hacer ejercicios extra.
   */
  async iniciarSesion(
    planId?: string,
    opts?: { extra?: boolean },
  ): Promise<'ok' | 'descanso' | 'error'> {
    try {
      const userId = this.usuarioId();
      if (!userId) return 'error';

      // Cargar plan (planId de la ruta o plan activo del paciente)
      let plan: PlanCompleto | null = null;
      if (planId) {
        plan = await this.planesService.getPlanById(planId);
      } else {
        plan = await this.cargarPlanPaciente();
      }

      if (!plan || !plan.items?.length) {
        return 'error';
      }

      const ejerciciosHoy = this.filtrarEjerciciosHoy(plan.items);
      if (ejerciciosHoy.length === 0 && !opts?.extra) {
        // Día de descanso para este plan: mostrar pantalla de descanso.
        // planActivo se setea (con items vacíos) para que la página salga
        // del estado de carga y pueda ofrecer "hacer ejercicios extra".
        this.planActivo.set({ ...plan, items: [] });
        this.sesionEsExtra.set(false);
        this.estadoPantalla.set('resumen');
        return 'descanso';
      }

      const esExtra = ejerciciosHoy.length === 0;
      const items = esExtra ? plan.items : ejerciciosHoy;
      this.sesionEsExtra.set(esExtra);

      this.planActivo.set({ ...plan, items });

      // Consultar sesión Convex de hoy
      const session = await this.consultarSesionHoy();

      if (!session || session.estado !== 'en_curso') {
        // Sin sesión `en_curso`: arrancar limpio. Si existe una sesión
        // `completada`/`completada_parcial`, `comenzarSesion` la reabrirá
        // (openOrResume) cuando el usuario pulse "comenzar".
        this.ejercicioActualIndex.set(0);
        this.serieActual.set(1);
        this.estadoPantalla.set('resumen');
        this.registrosSesion.set([]);
        this.tiempoInicioSesion.set(null);
        this.sesionActualId.set(null);
        this.persistencia.limpiar();
        return 'ok';
      }

      // Sesión en curso: rehidratar
      this.sesionActualId.set(session._id);
      this.tiempoInicioSesion.set(
        session.fechaInicio ? new Date(session.fechaInicio) : null,
      );

      const registros = this.executionsToRegistros(session.executions ?? []);
      this.registrosSesion.set(registros);

      // Calcular el primer ejercicio sin execution completada como fallback
      const completedPlanExerciseIds = new Set(
        (session.executions ?? [])
          .filter((e) => e.completado)
          .map((e) => e.planExercise?._id)
          .filter((id): id is Id<'planExercises'> => !!id),
      );
      const firstUncompletedIdx = items.findIndex(
        (item) => {
          const id = this.tryResolvePlanExerciseId(item);
          return !id || !completedPlanExerciseIds.has(id as Id<'planExercises'>);
        },
      );
      const fallbackIdx =
        firstUncompletedIdx === -1
          ? Math.max(0, items.length - 1)
          : firstUncompletedIdx;

      // Aplicar hint si coincide con esta sesión
      const hint = this.persistencia.restaurarHint(session._id);
      if (hint) {
        this.ejercicioActualIndex.set(hint.ejercicioIndex);
        this.serieActual.set(hint.serieActual);
        this.estadoPantalla.set(hint.estadoPantalla);
      } else {
        this.ejercicioActualIndex.set(fallbackIdx);
        this.serieActual.set(1);
        this.estadoPantalla.set('resumen');
      }

      return 'ok';
    } catch (error) {
      this.logger.error('Error al iniciar sesión:', error);
      return 'error';
    }
  }

  /**
   * Iniciar una sesion con ejercicios de multiples planes. Si existe una
   * sesión Convex `en_curso` para hoy, rehidrata `registrosSesion`,
   * `sesionActualId` y avanza al primer ejercicio no completado (matching
   * por `EjercicioSesionMultiPlan.planItemId === execution.planExercise._id`).
   * Aplica el hint de UI guardado si coincide con la sesión rehidratada.
   */
  async iniciarSesionMultiPlan(config: ConfigSesionMultiPlan): Promise<boolean> {
    try {
      this.resetearEstado();

      this.modoMultiPlan.set(true);
      this.configSesion.set(config);
      this.ejerciciosMultiPlan.set(config.ejercicios);
      // Ejercicios de una fecha no programada ejecutados hoy = sesión extra
      // (solo copy; el backend clasifica los extras por su cuenta).
      this.sesionEsExtra.set(!config.esFechaProgramada);

      const session = await this.consultarSesionHoy();

      if (!session || session.estado !== 'en_curso') {
        // Sin sesión `en_curso`: arrancar limpio. Si hay una sesión
        // `completada`/`completada_parcial`, `comenzarSesion` la reabrirá
        // (openOrResume) cuando el usuario pulse "comenzar".
        this.ejercicioActualIndex.set(0);
        this.serieActual.set(1);
        this.estadoPantalla.set('resumen');
        this.registrosSesion.set([]);
        this.tiempoInicioSesion.set(null);
        this.sesionActualId.set(null);
        this.persistencia.limpiar();
        return true;
      }

      // Sesión en curso: rehidratar
      this.sesionActualId.set(session._id);
      this.tiempoInicioSesion.set(
        session.fechaInicio ? new Date(session.fechaInicio) : null,
      );
      this.registrosSesion.set(
        this.executionsToRegistros(session.executions ?? []),
      );

      const completedPlanExerciseIds = new Set(
        (session.executions ?? [])
          .filter((e) => e.completado)
          .map((e) => e.planExercise?._id)
          .filter((id): id is Id<'planExercises'> => !!id),
      );
      const firstUncompletedIdx = config.ejercicios.findIndex(
        (ej) =>
          !completedPlanExerciseIds.has(ej.planItemId as Id<'planExercises'>),
      );
      const fallbackIdx =
        firstUncompletedIdx === -1
          ? Math.max(0, config.ejercicios.length - 1)
          : firstUncompletedIdx;

      const hint = this.persistencia.restaurarHint(session._id);
      if (hint) {
        this.ejercicioActualIndex.set(hint.ejercicioIndex);
        this.serieActual.set(hint.serieActual);
        this.estadoPantalla.set(hint.estadoPantalla);
      } else {
        this.ejercicioActualIndex.set(fallbackIdx);
        this.serieActual.set(1);
        this.estadoPantalla.set('resumen');
      }

      return true;
    } catch (error) {
      this.logger.error('Error al iniciar sesion multi-plan:', error);
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

    // openOrResume es idempotente: si ya tenemos sessionId (rehidratado en
    // `iniciarSesion`), devolverá el mismo id. Si la sesión estaba cerrada,
    // la reabre.
    await this.crearSesionRemota(ahora);

    this.guardarHintUI();
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
      // Última serie del ejercicio: insertar execution (fire-and-forget) y
      // descanso antes del siguiente. La inserción NO bloquea la UX: si
      // falla, queda en `pendingExecutions` para reintentar al cierre.
      void this.registrarEjercicioCompletado();

      if (this.esUltimoEjercicio()) {
        this.avanzarEjercicio();
      } else {
        this.temporizador.iniciarDescanso(descanso, true);
        this.estadoPantalla.set('descanso');
      }
    }

    this.guardarHintUI();
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
    this.guardarHintUI();
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
    this.guardarHintUI();
  }

  /**
   * Insertar la execution en Convex inmediatamente al completar el
   * ejercicio. Si la red falla, encola en `pendingExecutions` para
   * reintentar en `aplicarFeedbackFinal`/`finalizarSesion`.
   */
  async registrarEjercicioCompletado(): Promise<void> {
    const ejercicio = this.ejercicioActual();
    const userId = this.usuarioId();
    if (!ejercicio?.id || !userId) return;

    const planItemId = this.modoMultiPlan()
      ? (ejercicio as EjercicioSesionMultiPlan).planItemId
      : ejercicio.id;

    const fechaHora = new Date().toISOString();
    const fecha = getMadridDate();

    let planExerciseId: Id<'planExercises'>;
    try {
      planExerciseId = this.resolvePlanExerciseId(planItemId) as Id<'planExercises'>;
    } catch (error) {
      this.logger.error('No se pudo resolver planExerciseId:', error);
      return;
    }

    // Guard anti-duplicados: no relanzar si ya hay un insert en vuelo para
    // este ejercicio (doble pulsación / reentrada tras rehidratar). El
    // backend deduplica igualmente por identidad, pero así evitamos filas
    // locales y round-trips innecesarios.
    if (this.inFlightPlanExerciseIds.has(planExerciseId)) return;
    this.inFlightPlanExerciseIds.add(planExerciseId);

    const payload: PendingExecutionPayload = {
      planExerciseId,
      fechaHora,
      fecha,
      completado: true,
      repeticionesRealizadas: ejercicio.repeticiones,
      duracionRealSeg: ejercicio.duracionSeg,
    };

    const registroBase: Omit<RegistroEjercicio, 'executionId' | 'id'> = {
      planItemId,
      pacienteId: userId,
      fechaHora,
      completado: true,
      repeticionesRealizadas: ejercicio.repeticiones,
      duracionRealSeg: ejercicio.duracionSeg,
    };

    try {
      const executionId = await this.convex.mutation(
        api.executions.mutations.create,
        payload,
      );

      this.upsertRegistroLocal({
        ...registroBase,
        executionId: executionId as string,
      });
    } catch (error) {
      this.logger.error('Error al registrar execution; encolando para retry:', error);
      this.pendingExecutions.push({ payload, registroBase });
    } finally {
      this.inFlightPlanExerciseIds.delete(planExerciseId);
    }
  }

  /**
   * Inserta o actualiza el registro local por `planItemId`: al repetir un
   * ejercicio (o rehidratar y volver a completarlo) el backend devuelve la
   * misma execution, así que en cliente tampoco debe duplicarse la fila.
   */
  private upsertRegistroLocal(registro: RegistroEjercicio): void {
    this.registrosSesion.update((regs) => {
      const idx = regs.findIndex(
        (r) =>
          r.planItemId === registro.planItemId ||
          (!!registro.executionId && r.executionId === registro.executionId),
      );
      if (idx === -1) return [...regs, registro];
      const next = regs.slice();
      next[idx] = { ...next[idx], ...registro };
      return next;
    });
  }

  /**
   * Aplicar feedback final de todos los ejercicios y cerrar la sesión.
   * Antes de aplicar, intenta drenar la cola de executions pendientes para
   * que sus feedbacks no se pierdan. Después usa `applyFeedbackBatch` (1
   * round-trip transaccional) y `sessions.complete`.
   */
  async aplicarFeedbackFinal(data: {
    feedbacks: { planItemId: string; dolor: number; nota?: string }[];
    observacionesGenerales?: string;
  }): Promise<void> {
    await this.drainPendingExecutions();

    // Reflejar el feedback en cliente para que la UI quede consistente
    // antes del round-trip a Convex.
    this.registrosSesion.update((regs) =>
      regs.map((reg) => {
        const feedback = data.feedbacks.find(
          (f) => f.planItemId === reg.planItemId,
        );
        if (feedback) {
          return {
            ...reg,
            dolorEscala: feedback.dolor,
            notaPaciente: feedback.nota,
          };
        }
        return reg;
      }),
    );

    const entradas = this.registrosSesion()
      .filter((r) => !!r.executionId)
      .map((r) => {
        const feedback = data.feedbacks.find(
          (f) => f.planItemId === r.planItemId,
        );
        if (!feedback) return null;
        return {
          executionId: r.executionId as Id<'exerciseExecutions'>,
          dolorEscala: feedback.dolor,
          notaPaciente: feedback.nota,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (entradas.length > 0) {
      try {
        await this.convex.mutation(
          api.executions.mutations.applyFeedbackBatch,
          { entradas },
        );
      } catch (error) {
        this.logger.error('Error al aplicar feedback batch:', error);
      }
    }

    await this.cerrarSesionRemota(data.observacionesGenerales);

    this.persistencia.limpiar();
  }

  /**
   * Reintenta los inserts de executions que fallaron (red caída u otro
   * error transitorio). Los que sigan fallando permanecen en cola para
   * un próximo intento.
   */
  private async drainPendingExecutions(): Promise<void> {
    if (this.pendingExecutions.length === 0) return;
    // `aplicarFeedbackFinal` y `finalizarSesion` pueden solaparse: un solo
    // drain a la vez para no reenviar la misma cola dos veces.
    if (this.draining) return;
    this.draining = true;

    try {
      // Dedupe de la cola por planExerciseId conservando el último payload
      // (reintentos de un mismo ejercicio encolados varias veces).
      const porPlanExercise = new Map<string, PendingExecution>();
      for (const pending of this.pendingExecutions) {
        porPlanExercise.set(pending.payload.planExerciseId, pending);
      }

      const remaining: PendingExecution[] = [];
      for (const pending of porPlanExercise.values()) {
        try {
          const executionId = await this.convex.mutation(
            api.executions.mutations.create,
            pending.payload,
          );
          this.upsertRegistroLocal({
            ...pending.registroBase,
            executionId: executionId as string,
          });
        } catch (error) {
          this.logger.error('Reintento de execution falló; permanece en cola:', error);
          remaining.push(pending);
        }
      }
      this.pendingExecutions = remaining;
    } finally {
      this.draining = false;
    }
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

    this.guardarHintUI();
  }

  /**
   * Pausar la sesión y volver al resumen
   */
  pausarSesion(): void {
    this.guardarHintUI();
    this.estadoPantalla.set('resumen');
  }

  /**
   * Finalizar la sesión sin pasar por feedback (e.g. usuario abandona).
   * Drena pendientes para no perder executions inserts fallidos.
   */
  async finalizarSesion(): Promise<boolean> {
    try {
      await this.drainPendingExecutions();
      this.persistencia.limpiar();
      this.resetearEstado();
      return true;
    } catch (error) {
      this.logger.error('Error al finalizar sesión:', error);
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
    this.pendingExecutions = [];
    this.inFlightPlanExerciseIds.clear();
    this.sesionEsExtra.set(false);
  }

  // ========= Hint de UI (delegado a SesionPersistenceService) =========

  private guardarHintUI(): void {
    const sessionId = this.sesionActualId();
    if (!sessionId) return;

    this.persistencia.guardarHint({
      sessionId,
      ejercicioIndex: this.ejercicioActualIndex(),
      serieActual: this.serieActual(),
      estadoPantalla: this.estadoPantalla(),
      timestamp: new Date().toISOString(),
    });
  }

  // ========= Persistencia remota (Convex) =========

  /**
   * Crear o reanudar la sesión remota al comenzar.
   * `sessions.mutations.create` (alias de `openOrResume`) es idempotente:
   * devuelve la misma `sessionId` para el mismo paciente y día.
   */
  private async crearSesionRemota(fechaInicio: Date): Promise<string | null> {
    try {
      const clinicaActivaId = this.clinicaActiva.selectedClinicaId();
      const sessionId = await this.convex.mutation(
        api.sessions.mutations.create,
        {
          fechaInicio: fechaInicio.toISOString(),
          clinicId: (clinicaActivaId ?? undefined) as never,
        },
      );

      if (sessionId) {
        this.sesionActualId.set(sessionId as string);
      }
      return sessionId as string;
    } catch (error) {
      this.logger.error('Error al crear sesión:', error);
      return null;
    }
  }

  /**
   * Consultar la sesión del paciente autenticado para hoy (zona Madrid).
   * Devuelve la primera (BN1: 1 sesión por paciente y día) o null.
   */
  private async consultarSesionHoy(): Promise<SesionRehidratable | null> {
    try {
      const fecha = getMadridDate();
      const clinicId = this.clinicaActiva.selectedClinicaId();
      const sessions = await this.convex.query(
        api.sessions.queries.getByPacienteAndDateWithExecutions,
        {
          fecha,
          ...(clinicId ? { clinicId: clinicId as Id<'clinics'> } : {}),
        },
      );
      const list = sessions as SesionRehidratable[] | undefined;
      return list?.[0] ?? null;
    } catch (error) {
      this.logger.error('Error al consultar sesión de hoy:', error);
      return null;
    }
  }

  /**
   * Cerrar la sesión remota con observaciones (Convex mutation sessions.complete)
   */
  private async cerrarSesionRemota(
    observacionesGenerales?: string,
  ): Promise<boolean> {
    const sesionId = this.sesionActualId();
    if (!sesionId) return false;

    try {
      await this.convex.mutation(api.sessions.mutations.complete, {
        sessionId: sesionId as Id<'sessions'>,
        fechaFin: new Date().toISOString(),
        observacionesGenerales: observacionesGenerales || undefined,
      });
      return true;
    } catch (error) {
      this.logger.error('Error al finalizar sesión:', error);
      return false;
    }
  }

  /**
   * Obtener registros del paciente de hoy (consumido por la feature
   * `actividad`). Lee de `exerciseExecutions` directamente.
   */
  async obtenerRegistrosHoy(pacienteId: string): Promise<RegistroEjercicio[]> {
    const hoy = getMadridDate();

    try {
      const convexUserId = this.resolveUserConvexId(pacienteId);
      const raw = await this.convex.query(
        api.executions.queries.listByPacienteAndDate,
        {
          pacienteId: convexUserId as Id<'users'>,
          fecha: hoy,
        },
      );

      const list = (raw as ConvexExecutionRecord[] | undefined) ?? [];
      return list.map((r) => mapConvexToRegistro(r));
    } catch (error) {
      this.logger.error('Error al obtener registros de hoy:', error);
      return [];
    }
  }

  // ========= Helpers =========

  private filtrarEjerciciosHoy(items: EjercicioPlan[]): EjercicioPlan[] {
    const hoy = getMadridDiaSemana();

    return items.filter((item) => {
      if (!item.diasSemana || item.diasSemana.length === 0) {
        return true;
      }
      return item.diasSemana.includes(hoy);
    });
  }

  /**
   * Convierte el array de `executions` que devuelve
   * `sessions.queries.getByPacienteAndDateWithExecutions` (con
   * `planExercise` expandido) en `RegistroEjercicio[]` con `executionId`.
   */
  private executionsToRegistros(
    executions: ExecutionRehidratable[],
  ): RegistroEjercicio[] {
    const userId = this.usuarioId() ?? '';
    return executions.map((e) => ({
      executionId: e._id,
      planItemId: e.planExercise?._id ?? '',
      pacienteId: userId,
      fechaHora: e.fechaHora,
      completado: e.completado,
      repeticionesRealizadas: e.repeticionesRealizadas,
      duracionRealSeg: e.duracionRealSeg,
      dolorEscala: e.dolorEscala,
      esfuerzoEscala: e.esfuerzoEscala,
      notaPaciente: e.notaPaciente,
    }));
  }

  private resolvePlanExerciseId(planItem: unknown): string {
    if (typeof planItem === 'string' && planItem.length > 20) return planItem;
    if (typeof planItem === 'object' && planItem !== null) {
      const convexId = (planItem as { _convexId?: unknown })._convexId;
      if (typeof convexId === 'string') return convexId;
    }
    if (typeof planItem === 'number' || typeof planItem === 'string') {
      const items = this.planActivo()?.items ?? [];
      const found = items.find((i) => {
        const candidate = i as EjercicioPlan & { _convexId?: string };
        return candidate.id === planItem || candidate._convexId === planItem;
      });
      const candidateConvexId = (found as { _convexId?: string } | undefined)?._convexId;
      if (candidateConvexId) return candidateConvexId;
    }
    throw new Error(`No se pudo resolver planExerciseId: ${String(planItem)}`);
  }

  /**
   * Variante no-throw del resolver, usada en bucles donde no queremos que
   * un item sin `_convexId` rompa la rehidratación.
   */
  private tryResolvePlanExerciseId(planItem: unknown): string | null {
    try {
      return this.resolvePlanExerciseId(planItem);
    } catch {
      return null;
    }
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
