//
// planes/builder/plan-builder.service.ts
import {
  Injectable,
  signal,
  computed,
  inject,
  Injector,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { AsignacionesService } from '../../pacientes/data-access/asignaciones.service';
import { RutinasService } from '../../rutinas/data-access/rutinas.service';
import { PlanesService } from './planes.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import {
  Usuario,
  ID,
  Ejercicio,
  EjercicioPlan,
  CreateRutinaPayload,
} from '../../../../types/global';
import { BuilderItemsState } from './internal/builder-items-state';
import {
  BuilderPersistence,
  PersistedEnvelope,
} from './internal/builder-persistence';

interface PersistedStateV1 extends PersistedEnvelope {
  v: 1;
  paciente: Usuario | null;
  fisioId: string;
  titulo: string;
  descripcion: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  items: EjercicioPlan[];
  drawerOpen: boolean;
}

const PLAN_STORAGE_PREFIX = 'kengo:plan_builder:v1:';
const SCHEMA_VERSION = 1;
const DEFAULT_TTL_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class PlanBuilderService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private asignacionesService = inject(AsignacionesService);
  private rutinasService = inject(RutinasService);
  private planesService = inject(PlanesService);
  private router = inject(Router);
  private injector = inject(Injector);

  private readonly itemsState = new BuilderItemsState();

  private readonly planPersistence = new BuilderPersistence<
    PersistedStateV1,
    { fisioId: string; pacienteId: string }
  >({
    schemaVersion: SCHEMA_VERSION,
    ttlDays: DEFAULT_TTL_DAYS,
    makeKey: ({ fisioId, pacienteId }) =>
      `${PLAN_STORAGE_PREFIX}f=${fisioId}:p=${pacienteId}`,
  });

  // --- Modo edicion ---
  readonly planId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.planId() !== null);

  /** Devuelve true si el plan ya está cargado en memoria para este planId */
  isAlreadyLoadedForEdit(planId: string): boolean {
    return this.planId() === planId && this.items().length > 0;
  }

  // --- Versionado ---
  readonly hasActivity = signal<boolean>(false);
  readonly currentVersion = signal<number>(1);

  readonly paciente = signal<Usuario | null>(null);

  readonly fisioId = computed(() => {
    if (!this.sessionService.enModoFisio()) return null;
    return this.sessionService.usuario()?.id || null;
  });

  readonly items = this.itemsState.items;
  readonly titulo = signal<string>('');
  readonly descripcion = signal<string>('');
  readonly fechaInicio = signal<string | null>(null);
  readonly fechaFin = signal<string | null>(null);

  readonly totalItems = computed(() => this.items().length);
  readonly isReadyToConfigure = computed(() => this.items().length > 0);
  readonly canSubmit = computed(
    () => !!this.paciente() && !!this.fisioId() && this.items().length > 0,
  );

  // --- Dirty tracking (edit mode) ---
  private readonly originalSnapshot = signal<string | null>(null);

  readonly isDirty = computed(() => {
    const snap = this.originalSnapshot();
    if (snap === null) return false; // no snapshot = no edit mode or not loaded yet
    return snap !== this.captureSnapshot();
  });

  readonly drawerOpen = this.itemsState.drawerOpen;
  private saveTimer: any = null; // debounce: simple setTimeout

  constructor() {
    // Auto-guardar con debounce cuando cambie algo relevante
    effect(
      () => {
        const p = this.paciente();
        const f = this.fisioId();
        // Tracking de signals que disparan el save
        const _ = [
          this.titulo(),
          this.descripcion(),
          this.fechaInicio(),
          this.fechaFin(),
          ...this.items(),
        ];

        if (!p || !f) return;
        this.scheduleSave(350);
      },
      { injector: this.injector },
    );
  }

  private scheduleSave(ms: number) {
    // Sin items, no hay nada útil que persistir. Evita guardar borradores
    // vacíos cuando consumidores como `ejercicio-detail` llaman
    // `paciente.set(p)` antes de añadir ningún ejercicio.
    if (this.items().length === 0) return;

    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveToStorage(), ms);
  }

  private makePersisted(): PersistedStateV1 | null {
    const p = this.paciente();
    const f = this.fisioId();
    if (!p || !f) return null;

    const envelope = this.planPersistence.buildEnvelope();
    return {
      v: SCHEMA_VERSION,
      updatedAt: envelope.updatedAt,
      expiresAt: envelope.expiresAt,
      paciente: p,
      fisioId: f,
      titulo: this.titulo(),
      descripcion: this.descripcion(),
      fechaInicio: this.fechaInicio(),
      fechaFin: this.fechaFin(),
      drawerOpen: this.drawerOpen(),
      items: this.items(),
    };
  }

  private saveToStorage() {
    const snap = this.makePersisted();
    if (!snap || !snap.paciente?.id) return;
    this.planPersistence.save(snap, {
      fisioId: snap.fisioId,
      pacienteId: snap.paciente.id,
    });
  }

  async tryRestoreFor(pacienteId: string, fisioId?: string) {
    const f = fisioId || this.fisioId();
    if (!f) return;

    const persisted = this.planPersistence.read({ fisioId: f, pacienteId });
    if (!persisted) return;

    // rehidrata cabecera
    this.paciente.set(persisted.paciente);
    this.titulo.set(persisted.titulo);
    this.descripcion.set(persisted.descripcion);
    this.fechaInicio.set(persisted.fechaInicio);
    this.fechaFin.set(persisted.fechaFin);
    this.itemsState.closeDrawer();

    // rehidrata ejercicios: fetch por ids y fusiona con la dosificación guardada
    const items: EjercicioPlan[] = persisted.items
      .filter((x): x is EjercicioPlan => !!x)
      .sort((a, b) => a.sort - b.sort);

    this.itemsState.setItems(items);
  }

  private removeFromStorage(fisioId: string, pacienteId: string) {
    this.planPersistence.clear({ fisioId, pacienteId });
  }

  openDrawer() {
    this.itemsState.openDrawer();
  }
  closeDrawer() {
    this.itemsState.closeDrawer();
  }
  toggleDrawer() {
    this.itemsState.toggleDrawer();
  }

  async ensurePacienteLoaded(id: string) {
    if (this.paciente()?.id === id) return;
    const p = await this.getPacienteById(id);
    this.paciente.set(p);
  }

  async getPacienteById(id: string): Promise<Usuario | null> {
    const data = await this.convex.query(api.users.queries.getById, {
      userId: id as any,
    });
    if (!data) return null;
    return this.sessionService.transformarUsuarioConvex(data);
  }

  prepareForPaciente(p: Usuario | null) {
    if (!p) {
      this.clear();
      this.paciente.set(null);
    } else {
      this.paciente.set(p);
      this.tryRestoreFor(p.id);
      localStorage.setItem('carrito:last_paciente_id', p.id);
    }
  }

  navigateAndOpenDrawer() {
    if (!this.paciente()) {
      this.router.navigate(['/mis-pacientes']);
      this.closeDrawer();
    } else {
      this.router.navigate(['/ejercicios']);
      this.openDrawer();
    }
  }

  addEjercicio(
    e: Ejercicio,
    options?: { series?: number; repeticiones?: number },
  ) {
    this.itemsState.add(e, { ...options, descansoSeg: 20 });
  }

  removeEjercicio(ejercicioId: string) {
    this.itemsState.remove(ejercicioId);
  }

  clear() {
    // Limpiar Storage:
    const f = this.fisioId(),
      p = this.paciente();
    if (f && p) this.removeFromStorage(f, p.id);

    this.itemsState.clear();
    this.titulo.set('');
    this.descripcion.set('');
    this.fechaInicio.set(null);
    this.fechaFin.set(null);
  }

  reorder(fromIndex: number, toIndex: number) {
    this.itemsState.reorder(fromIndex, toIndex);
  }

  updateItem(idx: number, patch: Partial<EjercicioPlan>) {
    this.itemsState.updateItem(idx, patch);
  }

  async submitPlan(): Promise<string | null> {
    if (!this.canSubmit()) throw new Error('Faltan datos');
    const planId = await this.createPlanDeep({
      paciente: this.paciente()!.id,
      fisio: this.fisioId()!,
      titulo: this.titulo() || 'Plan sin título',
      descripcion: this.descripcion() || '',
      fechaInicio: this.fechaInicio(),
      fechaFin: this.fechaFin(),
      items: this.items().map((i, index) => ({
        ejercicio: i.ejercicio.id,
        sort: index + 1,
        series: i.series,
        repeticiones: i.repeticiones,
        duracionSeg: i.duracionSeg,
        descansoSeg: i.descansoSeg,
        diasSemana: i.diasSemana,
        instruccionesPaciente: i.instruccionesPaciente,
        notasFisio: i.notasFisio,
      })),
    });

    // Auto-asignar fisio responsable si el paciente no tiene uno, contra la
    // clínica activa (única fuente de contexto multiclinica).
    const f = this.fisioId();
    const p = this.paciente();
    if (planId && f && p) {
      const clinicaId = this.clinicaActiva.selectedClinicaId();
      if (clinicaId) {
        this.asignacionesService.autoAsignar(p.id, f, String(clinicaId));
      }
    }

    // limpiar storage del plan creado
    if (f && p) this.removeFromStorage(f, p.id);

    return planId;
  }

  async createPlanDeep(payload: {
    paciente: ID;
    fisio: string;
    titulo: string;
    descripcion?: string;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    items: {
      ejercicio: string;
      sort: number;
      series?: number;
      repeticiones?: number;
      duracionSeg?: number;
      descansoSeg?: number;
      diasSemana?: string[];
      instruccionesPaciente?: string;
      notasFisio?: string;
      media_personalizada?: string | null;
    }[];
  }): Promise<string | null> {
    try {
      const pacienteConvexId = this.resolvePatientConvexId(payload.paciente as string);
      if (!pacienteConvexId) {
        console.error('No se pudo resolver el Convex ID del paciente');
        return null;
      }

      const clinicaActivaId = this.clinicaActiva.selectedClinicaId();
      if (!clinicaActivaId) {
        throw new Error(
          'No hay clínica activa. Selecciona una clínica antes de crear el plan.',
        );
      }
      const planId = await this.convex.mutation(api.plans.mutations.create, {
        titulo: payload.titulo,
        descripcion: payload.descripcion ?? '',
        pacienteId: pacienteConvexId as any,
        clinicId: clinicaActivaId as any,
        fechaInicio: payload.fechaInicio ?? undefined,
        fechaFin: payload.fechaFin ?? undefined,
        ejercicios: payload.items.map((item) => ({
          exerciseId: item.ejercicio as any,
          sort: item.sort,
          series: item.series,
          repeticiones: item.repeticiones,
          duracionSeg: item.duracionSeg,
          descansoSeg: item.descansoSeg,
          diasSemana: item.diasSemana as any,
          instruccionesPaciente: item.instruccionesPaciente,
          notasFisio: item.notasFisio,
        })),
      });

      return planId as string;
    } catch (error) {
      console.error('Error al crear plan:', error);
      return null;
    }
  }

  // ============================================
  // DIRTY TRACKING
  // ============================================

  private captureSnapshot(): string {
    return JSON.stringify({
      titulo: this.titulo(),
      descripcion: this.descripcion(),
      fechaInicio: this.fechaInicio(),
      fechaFin: this.fechaFin(),
      items: this.items().map((i) => ({
        ejercicio: i.ejercicio.id,
        series: i.series,
        repeticiones: i.repeticiones,
        duracionSeg: i.duracionSeg,
        descansoSeg: i.descansoSeg,
        diasSemana: i.diasSemana,
        instruccionesPaciente: i.instruccionesPaciente,
        notasFisio: i.notasFisio,
        sort: i.sort,
      })),
    });
  }

  markAsSaved() {
    this.originalSnapshot.set(this.captureSnapshot());
  }

  // ============================================
  // MODO EDICION
  // ============================================

  setPlanId(id: string | null) {
    this.planId.set(id);
  }

  /**
   * Cargar un plan existente para editar
   */
  async loadPlanForEdit(planId: string): Promise<boolean> {
    try {
      const plan = await this.planesService.getPlanById(planId);
      if (!plan) return false;

      // Cargar paciente
      if (plan.paciente && typeof plan.paciente === 'object') {
        this.paciente.set(plan.paciente as Usuario);
      }

      // Cargar metadatos
      this.planId.set(planId);
      this.titulo.set(plan.titulo || '');
      this.descripcion.set(plan.descripcion || '');
      this.fechaInicio.set(
        plan.fechaInicio ? plan.fechaInicio.split('T')[0] : null,
      );
      this.fechaFin.set(
        plan.fechaFin ? plan.fechaFin.split('T')[0] : null,
      );

      // Cargar ejercicios
      this.itemsState.setItems(
        (plan.items || []).sort((a, b) => a.sort - b.sort),
      );

      // Versionado: guardar versión y comprobar actividad
      this.currentVersion.set((plan as any).version ?? 1);
      await this.checkPlanHasActivity(planId);

      // Capture snapshot for dirty tracking
      this.originalSnapshot.set(this.captureSnapshot());

      return true;
    } catch (error) {
      console.error('Error al cargar plan para editar:', error);
      return false;
    }
  }

  /**
   * Actualizar un plan existente
   */
  async updatePlan(): Promise<string | null> {
    const id = this.planId();
    if (!id || !this.canSubmit())
      throw new Error('Faltan datos para actualizar');

    try {
      // Una sola mutation atómica: metadata + replace all exercises
      await this.convex.mutation(api.plans.mutations.update, {
        planId: id as any,
        titulo: this.titulo() || 'Plan sin título',
        descripcion: this.descripcion() || '',
        fechaInicio: this.fechaInicio() ?? undefined,
        fechaFin: this.fechaFin() ?? undefined,
        ejercicios: this.items().map((item, i) => ({
          exerciseId: this.resolveExerciseIdFromItem(item),
          sort: i + 1,
          series: item.series,
          repeticiones: item.repeticiones,
          duracionSeg: item.duracionSeg,
          descansoSeg: item.descansoSeg,
          diasSemana: item.diasSemana as any,
          instruccionesPaciente: item.instruccionesPaciente,
          notasFisio: item.notasFisio,
        })),
      });

      // Limpiar storage
      const f = this.fisioId(),
        p = this.paciente();
      if (f && p) this.removeFromStorage(f, p.id);

      return id;
    } catch (error) {
      console.error('Error al actualizar plan:', error);
      return null;
    }
  }

  // ============================================
  // VERSIONADO DE PLANES
  // ============================================

  /**
   * Comprobar si un plan tiene registros de actividad del paciente
   */
  async checkPlanHasActivity(planId: string): Promise<boolean> {
    try {
      const hasData = await this.convex.query(
        api.plans.queries.checkPlanHasActivity,
        { planId: planId as any },
      );

      this.hasActivity.set(hasData);
      return hasData;
    } catch (error) {
      console.error('Error al verificar actividad del plan:', error);
      this.hasActivity.set(false);
      return false;
    }
  }

  /**
   * Crear nueva versión del plan: archiva el anterior y crea uno nuevo
   */
  async versionPlan(): Promise<string | null> {
    const oldPlanId = this.planId();
    if (!oldPlanId || !this.canSubmit()) {
      throw new Error('Faltan datos para versionar');
    }

    try {
      const tomorrow = new Date(Date.now() + 864e5).toISOString().split('T')[0];

      const newPlanId = await this.convex.mutation(api.plans.mutations.version, {
        oldPlanId: oldPlanId as any,
        titulo: this.titulo() || 'Plan sin título',
        descripcion: this.descripcion() || '',
        fechaInicio: this.fechaInicio() || tomorrow,
        fechaFin: this.fechaFin() ?? undefined,
        ejercicios: this.items().map((item, index) => ({
          exerciseId: this.resolveExerciseIdFromItem(item),
          sort: index + 1,
          series: item.series,
          repeticiones: item.repeticiones,
          duracionSeg: item.duracionSeg,
          descansoSeg: item.descansoSeg,
          diasSemana: item.diasSemana as any,
          instruccionesPaciente: item.instruccionesPaciente,
          notasFisio: item.notasFisio,
        })),
      });

      // Limpiar storage
      const f = this.fisioId(),
        p = this.paciente();
      if (f && p) this.removeFromStorage(f, p.id);

      return newPlanId as string;
    } catch (error) {
      console.error('Error al versionar plan:', error);
      return null;
    }
  }

  // ============================================
  // RUTINAS (Plantillas)
  // ============================================

  /**
   * Cargar ejercicios desde una rutina
   */
  async loadFromRutina(rutinaId: string): Promise<boolean> {
    try {
      const rutina = await this.rutinasService.getRutinaById(rutinaId);
      if (!rutina) return false;

      // Convertir ejercicios de rutina a ejercicios de plan
      const items: EjercicioPlan[] = rutina.ejercicios.map((e, idx) => ({
        sort: idx + 1,
        ejercicio: e.ejercicio,
        series: e.series ?? 3,
        repeticiones: e.repeticiones ?? 12,
        duracionSeg: e.duracionSeg,
        descansoSeg: e.descansoSeg ?? 45,
        diasSemana: e.diasSemana ?? ['L', 'X', 'V'],
        instruccionesPaciente: e.instruccionesPaciente,
        notasFisio: e.notasFisio,
      }));

      this.itemsState.setItems(items);

      // Opcional: usar nombre de rutina como base para titulo
      if (!this.titulo()) {
        this.titulo.set(rutina.nombre);
      }

      return true;
    } catch (error) {
      console.error('Error al cargar rutina:', error);
      return false;
    }
  }

  /**
   * Guardar la configuracion actual como rutina
   */
  async saveAsRutina(
    nombre: string,
    descripcion: string,
    visibilidad: 'privado' | 'clinica',
  ): Promise<string | null> {
    const fisio = this.fisioId();
    if (!fisio || this.items().length === 0) return null;

    const payload: CreateRutinaPayload = {
      nombre,
      descripcion,
      autor: fisio,
      visibilidad,
      ejercicios: this.items().map((item, idx) => ({
        ejercicio: item.ejercicio.id,
        sort: idx + 1,
        series: item.series,
        repeticiones: item.repeticiones,
        duracionSeg: item.duracionSeg,
        descansoSeg: item.descansoSeg,
        diasSemana: item.diasSemana,
        instruccionesPaciente: item.instruccionesPaciente,
        notasFisio: item.notasFisio,
      })),
    };

    return this.rutinasService.createRutina(payload);
  }

  /**
   * Reset completo del estado (para nuevo plan)
   */
  resetForNewPlan() {
    this.planId.set(null);
    this.itemsState.clear();
    this.titulo.set('');
    this.descripcion.set('');
    this.fechaInicio.set(null);
    this.fechaFin.set(null);
    this.originalSnapshot.set(null);
    this.hasActivity.set(false);
    this.currentVersion.set(1);
    // Mantener paciente si existe
  }

  /**
   * Reset completo incluyendo paciente
   */
  resetAll() {
    this.resetForNewPlan();
    this.paciente.set(null);
    this.closeDrawer();
    this.originalSnapshot.set(null);
  }

  // ============================================
  // HELPERS DE RESOLUCIÓN DE IDs
  // ============================================

  private resolveExerciseIdFromItem(item: EjercicioPlan): any {
    return item.ejercicio.id;
  }

  private resolvePatientConvexId(patientId: string): string | undefined {
    const currentUser = this.sessionService.usuario();
    // Si es el usuario actual
    if (currentUser?.id === patientId && currentUser.convexId) {
      return currentUser.convexId;
    }
    // Si el paciente signal tiene convexId
    const pac = this.paciente();
    if (pac?.id === patientId && pac.convexId) {
      return pac.convexId;
    }
    // Si parece un Convex ID (formato largo)
    if (patientId.length > 20) return patientId;
    return undefined;
  }
}
