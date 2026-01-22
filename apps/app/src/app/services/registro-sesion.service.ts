import {
  Injectable,
  computed,
  inject,
  signal,
  effect,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment as env } from '../../environments/environment';
import { AppService } from './app.service';
import { PlanesService } from './planes.service';

import {
  PlanCompleto,
  EjercicioPlan,
  EstadoPantalla,
  RegistroEjercicio,
  RegistroEjercicioDirectus,
  SesionLocal,
  FeedbackEjercicio,
  EjercicioSesionMultiPlan,
  ConfigSesionMultiPlan,
} from '../../types/global';

interface RegistroResponse {
  data: RegistroEjercicioDirectus;
}

interface RegistrosResponse {
  data: RegistroEjercicioDirectus[];
}

@Injectable({ providedIn: 'root' })
export class RegistroSesionService {
  private http = inject(HttpClient);
  private appService = inject(AppService);
  private planesService = inject(PlanesService);

  private readonly STORAGE_KEY = 'kengo:sesion_activa:v1';
  private readonly TTL_HORAS = 24;

  // ========= Estado de la sesión =========

  readonly planActivo = signal<PlanCompleto | null>(null);
  readonly ejercicioActualIndex = signal<number>(0);
  readonly serieActual = signal<number>(1);
  readonly estadoPantalla = signal<EstadoPantalla>('resumen');
  readonly registrosSesion = signal<RegistroEjercicio[]>([]);
  readonly tiempoInicioSesion = signal<Date | null>(null);
  readonly feedbackActual = signal<FeedbackEjercicio | null>(null);

  // Estado del temporizador
  readonly tiempoRestante = signal<number>(0);
  readonly temporizadorActivo = signal<boolean>(false);
  readonly descansoEntreEjercicios = signal<boolean>(false);

  // ========= Estado Multi-Plan =========
  readonly modoMultiPlan = signal<boolean>(false);
  readonly configSesion = signal<ConfigSesionMultiPlan | null>(null);
  readonly ejerciciosMultiPlan = signal<EjercicioSesionMultiPlan[]>([]);

  // ========= Computed =========

  // Titulo dinamico de la sesion
  readonly tituloSesion = computed(() => {
    if (this.modoMultiPlan()) {
      return this.configSesion()?.titulo ?? 'Tu sesion';
    }
    return this.planActivo()?.titulo ?? 'Tu sesion';
  });

  // Lista unificada de ejercicios (funciona para ambos modos)
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

  readonly esTipoTemporizador = computed(() => {
    const ej = this.ejercicioActual();
    return ej?.duracion_seg !== undefined && ej.duracion_seg > 0;
  });

  readonly tiempoTranscurrido = computed(() => {
    const inicio = this.tiempoInicioSesion();
    if (!inicio) return 0;
    return Math.floor((Date.now() - inicio.getTime()) / 1000);
  });

  readonly usuarioId = computed(() => this.appService.usuario()?.id ?? null);

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
      // Buscar planes activos del paciente
      const planes = await this.planesService.getPlanesByPaciente(userId);
      const planActivo = planes.find((p) => p.estado === 'activo');

      if (!planActivo) return null;

      // Cargar plan completo
      const planCompleto = await this.planesService.getPlanById(planActivo.id_plan);
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
  async iniciarSesion(planId?: number): Promise<boolean> {
    try {
      // Si hay sesión guardada, intentar restaurarla
      if (this.restaurarProgresoLocal()) {
        return true;
      }

      // Cargar plan
      let plan: PlanCompleto | null = null;

      if (planId) {
        plan = await this.planesService.getPlanById(planId);
      } else {
        plan = await this.cargarPlanPaciente();
      }

      if (!plan || !plan.items?.length) {
        return false;
      }

      // Filtrar ejercicios para hoy según dias_semana
      const ejerciciosHoy = this.filtrarEjerciciosHoy(plan.items);
      if (ejerciciosHoy.length === 0) {
        // Si no hay ejercicios para hoy, mostrar todos
        // (puede que el fisio no haya configurado días)
      }

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
      // Limpiar estado previo
      this.resetearEstado();

      // Configurar modo multi-plan
      this.modoMultiPlan.set(true);
      this.configSesion.set(config);
      this.ejerciciosMultiPlan.set(config.ejercicios);

      // Inicializar estado de sesion
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
  comenzarSesion(): void {
    this.tiempoInicioSesion.set(new Date());
    this.estadoPantalla.set('ejercicio');
    this.serieActual.set(1);
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
    const descanso = ejercicio.descanso_seg ?? 45;

    if (serieActual < totalSeries) {
      // Hay más series: ir a descanso entre series
      this.serieActual.update((s) => s + 1);
      this.descansoEntreEjercicios.set(false);
      this.tiempoRestante.set(descanso);
      this.estadoPantalla.set('descanso');
    } else {
      // Última serie del ejercicio: registrar y descanso antes del siguiente
      this.registrarEjercicioCompletado();

      if (this.esUltimoEjercicio()) {
        // Era el último ejercicio: ir directo al feedback final
        this.avanzarEjercicio();
      } else {
        // Hay más ejercicios: descanso entre ejercicios
        this.descansoEntreEjercicios.set(true);
        this.tiempoRestante.set(descanso);
        this.estadoPantalla.set('descanso');
      }
    }

    this.guardarProgresoLocal();
  }

  /**
   * Saltar el descanso y continuar
   */
  saltarDescanso(): void {
    this.temporizadorActivo.set(false);

    if (this.descansoEntreEjercicios()) {
      // Descanso entre ejercicios: avanzar al siguiente
      this.descansoEntreEjercicios.set(false);
      this.avanzarEjercicio();
    } else {
      // Descanso entre series: continuar con el ejercicio actual
      this.estadoPantalla.set('ejercicio');
    }
    this.guardarProgresoLocal();
  }

  /**
   * Añadir tiempo al descanso
   */
  agregarTiempoDescanso(segundos: number = 15): void {
    this.tiempoRestante.update((t) => t + segundos);
  }

  /**
   * Cuando termina el descanso automáticamente
   */
  finalizarDescanso(): void {
    if (this.descansoEntreEjercicios()) {
      // Descanso entre ejercicios: avanzar al siguiente
      this.descansoEntreEjercicios.set(false);
      this.avanzarEjercicio();
    } else {
      // Descanso entre series: continuar con el ejercicio actual
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

    // En modo multi-plan, usar planItemId del ejercicio enriquecido
    const planItemId = this.modoMultiPlan()
      ? (ejercicio as EjercicioSesionMultiPlan).planItemId
      : ejercicio.id;

    // Crear registro sin dolor (se añade al final en feedback-final)
    const registro: RegistroEjercicio = {
      plan_item: planItemId,
      paciente: userId,
      fecha_hora: new Date().toISOString(),
      completado: true,
      repeticiones_realizadas: ejercicio.repeticiones,
      duracion_real_seg: ejercicio.duracion_seg,
    };

    // Añadir a registros pendientes
    this.registrosSesion.update((regs) => [...regs, registro]);
  }

  /**
   * Aplicar feedback final de todos los ejercicios y guardar
   */
  async aplicarFeedbackFinal(data: {
    feedbacks: Array<{ planItemId: number; dolor: number; nota?: string }>;
    observacionesGenerales?: string;
  }): Promise<void> {
    // Actualizar cada registro con su dolor y nota
    this.registrosSesion.update((regs) =>
      regs.map((reg) => {
        const feedback = data.feedbacks.find((f) => f.planItemId === reg.plan_item);
        if (feedback) {
          return {
            ...reg,
            dolor_escala: feedback.dolor,
            nota_paciente: feedback.nota,
          };
        }
        return reg;
      })
    );

    // Guardar en Directus
    await this.guardarRegistrosEnDirectus();
    this.limpiarProgresoLocal();
  }

  /**
   * Avanzar al siguiente ejercicio
   */
  avanzarEjercicio(): void {
    if (this.esUltimoEjercicio()) {
      // Todos los ejercicios completados: ir a feedback final
      this.estadoPantalla.set('feedback-final');
    } else {
      // Siguiente ejercicio
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
      await this.guardarRegistrosEnDirectus();
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
    this.tiempoRestante.set(0);
    this.temporizadorActivo.set(false);
    this.descansoEntreEjercicios.set(false);
  }

  // ========= Persistencia local =========

  guardarProgresoLocal(): void {
    const plan = this.planActivo();
    if (!plan) return;

    const data: SesionLocal = {
      planId: plan.id_plan,
      ejercicioIndex: this.ejercicioActualIndex(),
      serieActual: this.serieActual(),
      estado: this.estadoPantalla(),
      registrosPendientes: this.registrosSesion(),
      timestamp: new Date().toISOString(),
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error al guardar progreso local:', error);
    }
  }

  restaurarProgresoLocal(): boolean {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return false;

      const data: SesionLocal = JSON.parse(raw);

      // Verificar TTL
      const timestamp = new Date(data.timestamp);
      const ahora = new Date();
      const horasTranscurridas =
        (ahora.getTime() - timestamp.getTime()) / (1000 * 60 * 60);

      if (horasTranscurridas > this.TTL_HORAS) {
        this.limpiarProgresoLocal();
        return false;
      }

      // Cargar el plan
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
    } catch (error) {
      console.error('Error al restaurar progreso local:', error);
      this.limpiarProgresoLocal();
      return false;
    }
  }

  limpiarProgresoLocal(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error al limpiar progreso local:', error);
    }
  }

  // ========= CRUD Directus =========

  /**
   * Crear un registro de ejercicio en Directus
   */
  async crearRegistro(
    registro: Omit<RegistroEjercicio, 'id_registro'>
  ): Promise<number | null> {
    try {
      const response = await firstValueFrom(
        this.http.post<RegistroResponse>(
          `${env.DIRECTUS_URL}/items/planes_registros`,
          registro,
          { withCredentials: true }
        )
      );

      return response?.data?.id_registro ?? null;
    } catch (error) {
      console.error('Error al crear registro:', error);
      return null;
    }
  }

  /**
   * Guardar todos los registros pendientes en Directus
   */
  async guardarRegistrosEnDirectus(): Promise<boolean> {
    const registros = this.registrosSesion();
    if (registros.length === 0) return true;

    try {
      // Crear registros en batch
      await firstValueFrom(
        this.http.post(
          `${env.DIRECTUS_URL}/items/planes_registros`,
          registros,
          { withCredentials: true }
        )
      );

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
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const filter = {
      _and: [
        { paciente: { _eq: pacienteId } },
        { fecha_hora: { _gte: hoy.toISOString() } },
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
      console.error('Error al obtener registros de hoy:', error);
      return [];
    }
  }

  // ========= Helpers =========

  /**
   * Filtrar ejercicios que corresponden al día de hoy
   */
  private filtrarEjerciciosHoy(items: EjercicioPlan[]): EjercicioPlan[] {
    const diasSemana = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const hoy = diasSemana[new Date().getDay()];

    return items.filter((item) => {
      // Si no tiene días configurados, incluirlo siempre
      if (!item.dias_semana || item.dias_semana.length === 0) {
        return true;
      }
      return item.dias_semana.includes(hoy);
    });
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

  // ========= Helper de assets =========
  getAssetUrl(id?: string, width = 400, height = 300) {
    return id
      ? `${env.DIRECTUS_URL}/assets/${id}?width=${width}&height=${height}&fit=cover&format=webp`
      : '';
  }

  getVideoUrl(id?: string) {
    return id ? `${env.DIRECTUS_URL}/assets/${id}` : '';
  }
}
