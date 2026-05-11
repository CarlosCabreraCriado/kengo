import {
  Injectable,
  signal,
  computed,
  inject,
  Injector,
  effect,
} from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { RutinasService } from './rutinas.service';
import {
  Ejercicio,
  EjercicioPlan,
  CreateRutinaPayload,
} from '../../../../types/global';
import { BuilderItemsState } from '../../planes/data-access/internal/builder-items-state';
import {
  BuilderPersistence,
  PersistedEnvelope,
} from '../../planes/data-access/internal/builder-persistence';

interface PersistedRutinaStateV1 extends PersistedEnvelope {
  v: 1;
  fisioId: string;
  items: EjercicioPlan[];
  drawerOpen: boolean;
}

const RUTINA_STORAGE_PREFIX = 'kengo:rutina_builder:v1:';
const SCHEMA_VERSION = 1;
const DEFAULT_TTL_DAYS = 7;

/**
 * Builder dedicado a rutinas (plantillas de ejercicios reutilizables).
 *
 * Encapsula su propio `BuilderItemsState` y `BuilderPersistence`, sin
 * depender de `PlanBuilderService`. Una rutina viva no requiere paciente
 * ni fechas — solo un fisio que la edite.
 */
@Injectable({ providedIn: 'root' })
export class RutinaBuilderService {
  private sessionService = inject(SessionService);
  private rutinasService = inject(RutinasService);
  private injector = inject(Injector);

  private readonly itemsState = new BuilderItemsState();

  private readonly persistence = new BuilderPersistence<
    PersistedRutinaStateV1,
    { fisioId: string }
  >({
    schemaVersion: SCHEMA_VERSION,
    ttlDays: DEFAULT_TTL_DAYS,
    makeKey: ({ fisioId }) => `${RUTINA_STORAGE_PREFIX}f=${fisioId}`,
  });

  // --- Estado ---
  private readonly _isActive = signal(false);
  readonly isActive = this._isActive.asReadonly();

  readonly rutinaEditId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.rutinaEditId() !== null);

  readonly titulo = signal<string>('');
  readonly descripcion = signal<string>('');

  readonly items = this.itemsState.items;
  readonly drawerOpen = this.itemsState.drawerOpen;

  readonly fisioId = computed(() => {
    if (!this.sessionService.enModoFisio()) return null;
    return this.sessionService.usuario()?.id || null;
  });

  readonly totalItems = computed(() => this.items().length);
  readonly canSave = computed(
    () => !!this.fisioId() && this.items().length > 0,
  );

  // --- Dirty tracking (solo modo edición) ---
  private readonly originalSnapshot = signal<string | null>(null);
  readonly isDirty = computed(() => {
    const snap = this.originalSnapshot();
    if (snap === null) return false;
    return snap !== this.captureSnapshot();
  });

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(
      () => {
        const f = this.fisioId();
        const active = this.isActive();
        // Tracking de signals que disparan el save
        this.titulo();
        this.descripcion();
        this.items();

        if (!active || !f) return;
        this.scheduleSave(350);
      },
      { injector: this.injector },
    );
  }

  // ============================================
  // CICLO DE VIDA DEL MODO
  // ============================================

  /** Activa modo creación: limpia estado y abre drawer. */
  start(): void {
    this._isActive.set(true);
    this.rutinaEditId.set(null);
    this.itemsState.clear();
    this.titulo.set('');
    this.descripcion.set('');
    this.originalSnapshot.set(null);
    this.itemsState.openDrawer();
  }

  /** Activa modo edición: carga rutina existente. */
  async startEdit(rutinaId: string): Promise<{ visibilidad: string } | null> {
    const rutina = await this.rutinasService.getRutinaById(rutinaId);
    if (!rutina) return null;

    this._isActive.set(true);
    this.rutinaEditId.set(rutinaId);

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
    this.titulo.set(rutina.nombre);
    this.descripcion.set(rutina.descripcion || '');
    this.originalSnapshot.set(this.captureSnapshot());
    this.itemsState.openDrawer();

    return { visibilidad: rutina.visibilidad };
  }

  /** Cierra el modo: limpia storage, items y drawer. */
  exit(): void {
    this.clearStorage();
    this._isActive.set(false);
    this.rutinaEditId.set(null);
    this.itemsState.clear();
    this.titulo.set('');
    this.descripcion.set('');
    this.originalSnapshot.set(null);
    this.itemsState.closeDrawer();
  }

  /** Restaura el estado desde localStorage si existe y es válido. */
  tryRestore(): boolean {
    const f = this.fisioId();
    if (!f) return false;

    const persisted = this.persistence.read({ fisioId: f });
    if (!persisted || persisted.items.length === 0) return false;

    this._isActive.set(true);
    this.itemsState.setItems(persisted.items);
    if (persisted.drawerOpen) {
      this.itemsState.openDrawer();
    } else {
      this.itemsState.closeDrawer();
    }
    return true;
  }

  // ============================================
  // DIRTY TRACKING
  // ============================================

  private captureSnapshot(): string {
    return JSON.stringify({
      titulo: this.titulo(),
      descripcion: this.descripcion(),
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

  /** Re-captura el snapshot para descartar el estado dirty actual. */
  markAsSaved(): void {
    this.originalSnapshot.set(this.captureSnapshot());
  }

  // ============================================
  // PERSISTENCIA REMOTA
  // ============================================

  /** Crea una nueva rutina con el estado actual. */
  async save(
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

  /** Actualiza la rutina en edición. */
  async update(
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
        diasSemana: item.diasSemana,
        instruccionesPaciente: item.instruccionesPaciente,
        notasFisio: item.notasFisio,
      })),
    });
  }

  /** Reemplaza los items con los de otra rutina (flujo "duplicar"). */
  async loadFromRutina(rutinaId: string): Promise<boolean> {
    try {
      const rutina = await this.rutinasService.getRutinaById(rutinaId);
      if (!rutina) return false;

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
      if (!this.titulo()) {
        this.titulo.set(rutina.nombre);
      }
      return true;
    } catch (error) {
      console.error('Error al cargar rutina:', error);
      return false;
    }
  }

  // ============================================
  // ITEMS (delegado a BuilderItemsState)
  // ============================================

  add(
    ejercicio: Ejercicio,
    options?: { series?: number; repeticiones?: number },
  ): void {
    this.itemsState.add(ejercicio, options);
  }

  remove(ejercicioId: string): void {
    this.itemsState.remove(ejercicioId);
  }

  reorder(fromIndex: number, toIndex: number): void {
    this.itemsState.reorder(fromIndex, toIndex);
  }

  updateItem(idx: number, patch: Partial<EjercicioPlan>): void {
    this.itemsState.updateItem(idx, patch);
  }

  clear(): void {
    this.itemsState.clear();
  }

  openDrawer(): void {
    this.itemsState.openDrawer();
  }

  closeDrawer(): void {
    this.itemsState.closeDrawer();
  }

  toggleDrawer(): void {
    this.itemsState.toggleDrawer();
  }

  // ============================================
  // PERSISTENCIA LOCAL
  // ============================================

  private scheduleSave(ms: number): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveToStorage(), ms);
  }

  private saveToStorage(): void {
    const f = this.fisioId();
    if (!f) return;
    const envelope = this.persistence.buildEnvelope();
    const state: PersistedRutinaStateV1 = {
      v: SCHEMA_VERSION,
      updatedAt: envelope.updatedAt,
      expiresAt: envelope.expiresAt,
      fisioId: f,
      items: this.items(),
      drawerOpen: this.drawerOpen(),
    };
    this.persistence.save(state, { fisioId: f });
  }

  private clearStorage(): void {
    const f = this.fisioId();
    if (f) this.persistence.clear({ fisioId: f });
  }
}
