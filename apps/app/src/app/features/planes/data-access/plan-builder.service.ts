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
import { AsignacionesService } from '../../pacientes/data-access/asignaciones.service';
import { RutinasService } from '../../rutinas/data-access/rutinas.service';
import { EjerciciosService } from '../../ejercicios/data-access/ejercicios.service';
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

interface PersistedStateV1 {
  v: 1; // versión de esquema
  updatedAt: string; // ISO
  expiresAt?: string | null; // ISO
  paciente: Usuario | null;
  fisioId: string;
  titulo: string;
  descripcion: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  items: EjercicioPlan[];
  drawerOpen: boolean;
}

// Estado para modo rutina (sin paciente)
interface PersistedRutinaStateV1 {
  v: 1;
  updatedAt: string;
  expiresAt?: string | null;
  fisioId: string;
  items: EjercicioPlan[];
  drawerOpen: boolean;
}

//Persistencia localStorage
const STORAGE_PREFIX = 'kengo:plan_builder:v1:';
const storageKey = (fisioId: string, pacienteId: string) =>
  `${STORAGE_PREFIX}f=${fisioId}:p=${pacienteId}`;

// Persistencia para modo rutina
const STORAGE_PREFIX_RUTINA = 'kengo:rutina_builder:v1:';
const storageKeyRutina = (fisioId: string) =>
  `${STORAGE_PREFIX_RUTINA}f=${fisioId}`;

const DEFAULT_TTL_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class PlanBuilderService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);
  private asignacionesService = inject(AsignacionesService);
  private rutinasService = inject(RutinasService);
  private ejerciciosService = inject(EjerciciosService);
  private planesService = inject(PlanesService);
  private router = inject(Router);
  private injector = inject(Injector);

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

  // --- Modo rutina (sin paciente) ---
  readonly mode = signal<'plan' | 'rutina'>('plan');
  readonly isRutinaMode = computed(() => this.mode() === 'rutina');
  readonly rutinaEditId = signal<string | null>(null);
  readonly isRutinaEditMode = computed(() => this.rutinaEditId() !== null);

  // Computed para validar guardado de rutina (sin requerir paciente)
  readonly canSaveAsRutina = computed(
    () => !!this.fisioId() && this.items().length > 0,
  );

  readonly paciente = signal<Usuario | null>(null);

  readonly fisioId = computed(() => {
    const usuario = this.sessionService.usuario();
    if (usuario?.esFisio) {
      return usuario.id || null;
    } else {
      return null;
    }
  });

  readonly items = signal<EjercicioPlan[]>([]);
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

  readonly drawerOpen = signal(false);
  private saveTimer: any = null; // debounce: simple setTimeout
  private storageInicializado = false; // para evitar guardar al restaurar

  constructor() {
    // Auto-guardar con debounce cuando cambie algo relevante
    effect(
      () => {
        // leemos las señales (dispara el effect ante cambios)
        const p = this.paciente();
        const f = this.fisioId();
        const rutinaMode = this.isRutinaMode();

        const _ = [
          this.titulo(),
          this.descripcion(),
          this.fechaInicio(),
          this.fechaFin(),
          ...this.items(), // ojo: si es array de objetos, el trigger será por referencia; suele bastar
        ];

        // En modo rutina solo necesitamos fisioId
        if (rutinaMode) {
          if (!f) return;
          this.scheduleSaveRutina(350);
        } else {
          // Modo plan: requiere paciente y fisio
          if (!p || !f) return;
          this.scheduleSave(350);
        }
      },
      { injector: this.injector },
    );
  }

  private scheduleSave(ms: number) {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(
      () => this.saveToStorage().catch(console.warn),
      ms,
    );
  }

  private scheduleSaveRutina(ms: number) {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(
      () => this.saveRutinaToStorage().catch(console.warn),
      ms,
    );
  }

  private makePersisted(): PersistedStateV1 | null {
    const p = this.paciente();
    const f = this.fisioId();
    if (!p || !f) return null;

    const now = new Date();
    const expires = new Date(now.getTime() + DEFAULT_TTL_DAYS * 864e5);

    const data: PersistedStateV1 = {
      v: 1,
      updatedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      paciente: this.paciente(),
      fisioId: f,
      titulo: this.titulo(),
      descripcion: this.descripcion(),
      fechaInicio: this.fechaInicio(),
      fechaFin: this.fechaFin(),
      drawerOpen: this.drawerOpen(),
      items: this.items(),
    };
    return data;
  }

  private async saveToStorage() {
    const snap = this.makePersisted();
    if (!snap || !snap.paciente?.id) return;
    const key = storageKey(snap.fisioId, snap.paciente.id);
    localStorage.setItem(key, JSON.stringify(snap));
  }

  // Persistencia para modo rutina
  private makePersistedRutina(): PersistedRutinaStateV1 | null {
    const f = this.fisioId();
    if (!f) return null;

    const now = new Date();
    const expires = new Date(now.getTime() + DEFAULT_TTL_DAYS * 864e5);

    return {
      v: 1,
      updatedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      fisioId: f,
      items: this.items(),
      drawerOpen: this.drawerOpen(),
    };
  }

  private async saveRutinaToStorage() {
    const snap = this.makePersistedRutina();
    if (!snap) return;
    const key = storageKeyRutina(snap.fisioId);
    localStorage.setItem(key, JSON.stringify(snap));
  }

  private readRutinaFromStorage(fisioId: string): PersistedRutinaStateV1 | null {
    const key = storageKeyRutina(fisioId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const json = JSON.parse(raw) as PersistedRutinaStateV1;
      if (json.v !== 1) return null;
      if (json.expiresAt && Date.now() > Date.parse(json.expiresAt)) {
        localStorage.removeItem(key);
        return null;
      }
      return json;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }

  private clearRutinaStorage() {
    const f = this.fisioId();
    if (f) {
      localStorage.removeItem(storageKeyRutina(f));
    }
  }

  async tryRestoreFor(pacienteId: string, fisioId?: string) {
    const f = fisioId || this.fisioId();
    if (!f) return;

    const persisted = this.readFromStorage(f, pacienteId);
    if (!persisted) return;

    // rehidrata cabecera
    this.paciente.set(persisted.paciente);
    this.titulo.set(persisted.titulo);
    this.descripcion.set(persisted.descripcion);
    this.fechaInicio.set(persisted.fechaInicio);
    this.fechaFin.set(persisted.fechaFin);
    this.drawerOpen.set(false);

    // rehidrata ejercicios: fetch por ids y fusiona con la dosificación guardada
    const items: EjercicioPlan[] = persisted.items
      .filter((x): x is EjercicioPlan => !!x)
      .sort((a, b) => a.sort - b.sort);

    this.items.set(items);
  }

  private readFromStorage(
    fisioId: string,
    pacienteId: string,
  ): PersistedStateV1 | null {
    const key = storageKey(fisioId, pacienteId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const json = JSON.parse(raw) as PersistedStateV1;
      if (json.v !== 1) return null; // versión incompatible → ignora (o migra)
      if (json.expiresAt && Date.now() > Date.parse(json.expiresAt)) {
        localStorage.removeItem(key);
        return null;
      }
      return json;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }

  private removeFromStorage(fisioId: string, pacienteId: string) {
    localStorage.removeItem(storageKey(fisioId, pacienteId));
  }

  openDrawer() {
    this.drawerOpen.set(true);
  }
  closeDrawer() {
    this.drawerOpen.set(false);
  }
  toggleDrawer() {
    this.drawerOpen.update((v) => !v);
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

  cambiarPaciente(p: Usuario | null) {
    if (!p) {
      this.clear();
      this.paciente.set(null);
      this.router.navigate(['/mis-pacientes']);
      this.closeDrawer();
    } else {
      this.paciente.set(p);
      this.tryRestoreFor(p.id);
      localStorage.setItem('carrito:last_paciente_id', p.id);
      this.router.navigate(['/galeria/ejercicios']);
      this.openDrawer();
    }
  }

  addEjercicio(e: Ejercicio, options?: { series?: number; repeticiones?: number }) {
    const exists = this.items().some(
      (i) => i.ejercicio.id === e.id,
    );
    if (exists) return; // evita duplicado; si quieres permitir, elimina este guard
    const orden = this.items().length + 1;

    const series = options?.series ?? e.seriesDefecto ?? 3;
    const repeticiones = options?.repeticiones ?? e.repeticionesDefecto ?? 12;

    this.items.update((list) => [
      ...list,
      {
        ejercicio: e,
        sort: orden,
        series,
        repeticiones,
        duracionSeg: undefined,
        descansoSeg: 45,
        vecesDia: 1,
        diasSemana: ['L', 'X', 'V'],
      },
    ]);
    this.openDrawer();
  }

  removeEjercicio(ejercicioId: string) {
    this.items.update((list) =>
      list
        .filter((i) => i.ejercicio.id !== ejercicioId)
        .map((i, idx) => ({ ...i, sort: idx + 1 })),
    );
  }

  clear() {
    // Limpiar Storage:
    const f = this.fisioId(),
      p = this.paciente();
    if (f && p) this.removeFromStorage(f, p.id);

    this.items.set([]);
    this.titulo.set('');
    this.descripcion.set('');
    this.fechaInicio.set(null);
    this.fechaFin.set(null);
  }

  reorder(fromIndex: number, toIndex: number) {
    const arr = [...this.items()];
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    this.items.set(arr.map((i, idx) => ({ ...i, sort: idx + 1 })));
  }

  updateItem(idx: number, patch: Partial<EjercicioPlan>) {
    const arr = [...this.items()];
    arr[idx] = { ...arr[idx], ...patch };
    this.items.set(arr);
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
        vecesDia: i.vecesDia,
        diasSemana: i.diasSemana,
        instruccionesPaciente: i.instruccionesPaciente,
        notasFisio: i.notasFisio,
      })),
    });

    // Auto-asignar fisio responsable si el paciente no tiene uno
    const f = this.fisioId();
    const p = this.paciente();
    if (planId && f && p) {
      const clinicas = this.sessionService.usuario()?.clinicas ?? [];
      const clinicaId = clinicas[0]?.clinicId;
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
      vecesDia?: number;
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

      await this.convex.mutation(api.plans.mutations.create, {
        titulo: payload.titulo,
        descripcion: payload.descripcion ?? '',
        pacienteId: pacienteConvexId as any,
        fechaInicio: payload.fechaInicio ?? undefined,
        fechaFin: payload.fechaFin ?? undefined,
        ejercicios: payload.items.map((item) => ({
          exerciseId: item.ejercicio as any,
          sort: item.sort,
          series: item.series,
          repeticiones: item.repeticiones,
          duracionSeg: item.duracionSeg,
          descansoSeg: item.descansoSeg,
          vecesDia: item.vecesDia,
          diasSemana: item.diasSemana as any,
          instruccionesPaciente: item.instruccionesPaciente,
          notasFisio: item.notasFisio,
        })),
      });

      return null;
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
        vecesDia: i.vecesDia,
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
      this.items.set(
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
          vecesDia: item.vecesDia,
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

      await this.convex.mutation(api.plans.mutations.version, {
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
          vecesDia: item.vecesDia,
          diasSemana: item.diasSemana as any,
          instruccionesPaciente: item.instruccionesPaciente,
          notasFisio: item.notasFisio,
        })),
      });

      // Limpiar storage
      const f = this.fisioId(),
        p = this.paciente();
      if (f && p) this.removeFromStorage(f, p.id);

      return null;
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
        vecesDia: e.vecesDia ?? 1,
        diasSemana: e.diasSemana ?? ['L', 'X', 'V'],
        instruccionesPaciente: e.instruccionesPaciente,
        notasFisio: e.notasFisio,
      }));

      this.items.set(items);

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
        vecesDia: item.vecesDia,
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
    this.items.set([]);
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
  // MODO RUTINA (crear plantillas sin paciente)
  // ============================================

  /**
   * Activa modo rutina: limpia paciente, abre drawer
   */
  startRutinaMode() {
    this.mode.set('rutina');
    this.paciente.set(null);
    this.planId.set(null);
    this.items.set([]);
    this.titulo.set('');
    this.descripcion.set('');
    this.fechaInicio.set(null);
    this.fechaFin.set(null);
    this.openDrawer();
  }

  /**
   * Activa modo edición de rutina: carga datos existentes
   */
  async startEditRutinaMode(rutinaId: string): Promise<{ visibilidad: string } | null> {
    const rutina = await this.rutinasService.getRutinaById(rutinaId);
    if (!rutina) return null;

    this.mode.set('rutina');
    this.rutinaEditId.set(rutinaId);
    this.paciente.set(null);
    this.planId.set(null);

    const items: EjercicioPlan[] = rutina.ejercicios.map((e, idx) => ({
      sort: idx + 1,
      ejercicio: e.ejercicio,
      series: e.series ?? 3,
      repeticiones: e.repeticiones ?? 12,
      duracionSeg: e.duracionSeg,
      descansoSeg: e.descansoSeg ?? 45,
      vecesDia: e.vecesDia ?? 1,
      diasSemana: e.diasSemana ?? ['L', 'X', 'V'],
      instruccionesPaciente: e.instruccionesPaciente,
      notasFisio: e.notasFisio,
    }));

    this.items.set(items);
    this.titulo.set(rutina.nombre);
    this.descripcion.set(rutina.descripcion || '');
    this.openDrawer();

    return { visibilidad: rutina.visibilidad };
  }

  /**
   * Actualizar rutina existente
   */
  async updateRutina(
    nombre: string,
    descripcion: string,
    visibilidad: 'privado' | 'clinica',
  ): Promise<boolean> {
    const rutinaId = this.rutinaEditId();
    if (!rutinaId || this.items().length === 0) return false;

    return this.rutinasService.updateRutinaCompleta(rutinaId, {
      nombre,
      descripcion,
      visibilidad,
      ejercicios: this.items().map((item, idx) => ({
        ejercicio: item.ejercicio.id,
        sort: idx + 1,
        series: item.series,
        repeticiones: item.repeticiones,
        duracionSeg: item.duracionSeg,
        descansoSeg: item.descansoSeg,
        vecesDia: item.vecesDia,
        diasSemana: item.diasSemana,
        instruccionesPaciente: item.instruccionesPaciente,
        notasFisio: item.notasFisio,
      })),
    });
  }

  /**
   * Sale del modo rutina y vuelve a modo plan
   */
  exitRutinaMode() {
    this.clearRutinaStorage();
    this.mode.set('plan');
    this.rutinaEditId.set(null);
    this.items.set([]);
    this.titulo.set('');
    this.descripcion.set('');
    this.closeDrawer();
  }

  /**
   * Intenta restaurar estado de modo rutina desde localStorage
   */
  tryRestoreRutinaMode(): boolean {
    const f = this.fisioId();
    if (!f) return false;

    const persisted = this.readRutinaFromStorage(f);
    if (!persisted || persisted.items.length === 0) return false;

    // Restaurar estado
    this.mode.set('rutina');
    this.paciente.set(null);
    this.items.set(persisted.items);
    this.drawerOpen.set(persisted.drawerOpen);

    return true;
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
