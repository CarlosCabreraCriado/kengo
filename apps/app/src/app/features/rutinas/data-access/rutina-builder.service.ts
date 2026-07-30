import {
  Injectable,
  signal,
  computed,
  inject,
  Injector,
  effect,
} from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { SessionResettable } from '../../../core/auth/session-resettable';
import { LoggerService } from '../../../core/services/logger.service';
import { RutinasService, type GuardarRutinaResult } from './rutinas.service';
import { errorRutinaLocal } from './rutina-error';
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
const DEFAULT_TTL_DAYS = 1;

/**
 * Builder dedicado a rutinas (plantillas de ejercicios reutilizables).
 *
 * Encapsula su propio `BuilderItemsState` y `BuilderPersistence`, sin
 * depender de `PlanBuilderService`. Una rutina viva no requiere paciente
 * ni fechas — solo un fisio que la edite.
 */
@Injectable({ providedIn: 'root' })
export class RutinaBuilderService implements SessionResettable {
  private sessionService = inject(SessionService);
  private rutinasService = inject(RutinasService);
  private injector = inject(Injector);
  private logger = inject(LoggerService);

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

  /**
   * Clínica que la rutina en edición ya tenía. Se conserva para no reasignarla
   * a la clínica activa al guardar (ver `updateRutinaCompleta`).
   */
  private readonly rutinaEditClinicId = signal<string | undefined>(undefined);

  /**
   * `true` si el usuario creó la rutina en edición. Un fisio/admin de la
   * clínica puede editar el contenido de una rutina ajena, pero no cambiar su
   * visibilidad ni moverla de clínica.
   */
  readonly esAutorDeRutinaEnEdicion = signal(true);

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
  private lastUserIdSeen: string | null = null;

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

    // Defensa en profundidad: si el usuario autenticado cambia a otro
    // distinto sin pasar por logout explícito, descartar el estado
    // residual del usuario anterior.
    effect(
      () => {
        const currentUserId = this.sessionService.usuario()?.id ?? null;
        const previousId = this.lastUserIdSeen;
        this.lastUserIdSeen = currentUserId;
        if (previousId && currentUserId && previousId !== currentUserId) {
          this.resetSessionState();
        }
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
    this.rutinaEditClinicId.set(undefined);
    this.esAutorDeRutinaEnEdicion.set(true);
    this.itemsState.clear();
    this.titulo.set('');
    this.descripcion.set('');
    this.originalSnapshot.set(null);
    this.itemsState.openDrawer();
  }

  /**
   * Activa modo edición: carga rutina existente.
   *
   * A diferencia de `start()`, no abre el drawer: en `/rutinas/:id/editar` la
   * pestaña del carrito está oculta, así que un panel abierto ahí no se podría
   * reabrir tras cerrarlo. Se abre al ir al catálogo (`navegarACatalogo`), igual
   * que hace `plan-builder` en `irAGaleria()`.
   */
  async startEdit(
    rutinaId: string,
  ): Promise<{ visibilidad: string; esAutor: boolean } | null> {
    const res = await this.rutinasService.getRutinaById(rutinaId);
    if (res.status !== 'ok') return null;
    const rutina = res.rutina;

    this._isActive.set(true);
    this.rutinaEditId.set(rutinaId);
    this.rutinaEditClinicId.set(rutina.clinicId);

    const esAutor = rutina.autor?.id === this.sessionService.usuario()?.id;
    this.esAutorDeRutinaEnEdicion.set(esAutor);

    const items: EjercicioPlan[] = rutina.ejercicios.map((e, idx) => ({
      sort: idx + 1,
      ejercicio: e.ejercicio,
      tipo: e.tipo ?? e.ejercicio.tipo,
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

    return { visibilidad: rutina.visibilidad, esAutor };
  }

  /** Cierra el modo: limpia storage, items y drawer. */
  exit(): void {
    this.clearStorage();
    this._isActive.set(false);
    this.rutinaEditId.set(null);
    this.rutinaEditClinicId.set(undefined);
    this.esAutorDeRutinaEnEdicion.set(true);
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
        tipo: i.tipo,
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
  ): Promise<GuardarRutinaResult> {
    const fisio = this.fisioId();
    if (!fisio) {
      return {
        status: 'fallo',
        error: errorRutinaLocal(
          'Necesitas el modo fisioterapeuta',
          'Solo se pueden crear rutinas desde una clínica en la que seas fisioterapeuta o administrador. Cambia de clínica y vuelve a intentarlo.',
        ),
      };
    }
    if (this.items().length === 0) {
      return {
        status: 'fallo',
        error: errorRutinaLocal(
          'La rutina no tiene ejercicios',
          'Añade al menos un ejercicio antes de guardar la rutina.',
        ),
      };
    }

    const payload: CreateRutinaPayload = {
      nombre,
      descripcion,
      autor: fisio,
      visibilidad,
      ejercicios: this.items().map((item, idx) => ({
        ejercicio: item.ejercicio.id,
        sort: idx + 1,
        tipo: item.tipo,
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
  ): Promise<GuardarRutinaResult> {
    const rutinaId = this.rutinaEditId();
    if (!rutinaId) {
      return {
        status: 'fallo',
        error: errorRutinaLocal(
          'No hay ninguna rutina en edición',
          'Se ha perdido la referencia a la rutina. Vuelve al listado y ábrela de nuevo.',
        ),
      };
    }
    if (this.items().length === 0) {
      return {
        status: 'fallo',
        error: errorRutinaLocal(
          'La rutina no tiene ejercicios',
          'Una rutina necesita al menos un ejercicio. Añade alguno o elimina la rutina desde el listado.',
        ),
      };
    }

    return this.rutinasService.updateRutinaCompleta(
      rutinaId,
      {
        nombre,
        descripcion,
        visibilidad,
        ejercicios: this.items().map((item, idx) => ({
          ejercicio: item.ejercicio.id,
          sort: idx + 1,
          tipo: item.tipo,
          series: item.series,
          repeticiones: item.repeticiones,
          duracionSeg: item.duracionSeg,
          descansoSeg: item.descansoSeg,
          diasSemana: item.diasSemana,
          instruccionesPaciente: item.instruccionesPaciente,
          notasFisio: item.notasFisio,
        })),
      },
      this.rutinaEditClinicId(),
    );
  }

  /** Reemplaza los items con los de otra rutina (flujo "duplicar"). */
  async loadFromRutina(rutinaId: string): Promise<boolean> {
    try {
      const res = await this.rutinasService.getRutinaById(rutinaId);
      if (res.status !== 'ok') return false;
      const rutina = res.rutina;

      const items: EjercicioPlan[] = rutina.ejercicios.map((e, idx) => ({
        sort: idx + 1,
        ejercicio: e.ejercicio,
        tipo: e.tipo ?? e.ejercicio.tipo,
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
      this.logger.error('Error al cargar rutina:', error);
      return false;
    }
  }

  // ============================================
  // ITEMS (delegado a BuilderItemsState)
  // ============================================

  add(
    ejercicio: Ejercicio,
    options?: { series?: number; repeticiones?: number; duracionSeg?: number },
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

  /**
   * Invocado por `SessionService.limpiar()` al cerrar sesión y por el
   * effect reactivo si el usuario autenticado cambia. Cancela escrituras
   * pendientes, purga TODAS las entradas en localStorage del builder
   * (de cualquier fisio) y blanquea signals vía `exit()`.
   */
  resetSessionState(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.purgeAllRutinaBuilderStorage();
    this.exit();
  }

  private purgeAllRutinaBuilderStorage(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(RUTINA_STORAGE_PREFIX)) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // localStorage puede fallar en modo privado; ignorar.
    }
  }
}
