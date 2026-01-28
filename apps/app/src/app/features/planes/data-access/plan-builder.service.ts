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
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Router } from '@angular/router';
import { SessionService } from '../../../core/auth/services/session.service';
import { RutinasService } from '../../rutinas/data-access/rutinas.service';
import { environment as env } from '../../../../environments/environment';
import {
  UsuarioDirectus,
  Usuario,
  ID,
  Ejercicio,
  EjercicioPlan,
  PlanCompleto,
  PlanDirectus,
  EjercicioPlanDirectus,
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
  fecha_inicio: string | null;
  fecha_fin: string | null;
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
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);
  private rutinasService = inject(RutinasService);
  private router = inject(Router);
  private injector = inject(Injector);

  // --- Modo edicion ---
  readonly planId = signal<number | null>(null);
  readonly isEditMode = computed(() => this.planId() !== null);

  // --- Modo rutina (sin paciente) ---
  readonly mode = signal<'plan' | 'rutina'>('plan');
  readonly isRutinaMode = computed(() => this.mode() === 'rutina');

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
  readonly fecha_inicio = signal<string | null>(null);
  readonly fecha_fin = signal<string | null>(null);

  readonly totalItems = computed(() => this.items().length);
  readonly isReadyToConfigure = computed(() => this.items().length > 0);
  readonly canSubmit = computed(
    () => !!this.paciente() && !!this.fisioId() && this.items().length > 0,
  );

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
          this.fecha_inicio(),
          this.fecha_fin(),
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
      fecha_inicio: this.fecha_inicio(),
      fecha_fin: this.fecha_fin(),
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
    this.fecha_inicio.set(persisted.fecha_inicio);
    this.fecha_fin.set(persisted.fecha_fin);
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
    const data = await this.http
      .get<{ data: UsuarioDirectus }>(
        `${env.DIRECTUS_URL}/items/usuarios/${id}`,
        {
          params: {
            fields:
              'id,first_name,last_name,email,avatar,clinicas.id_clinica,clinicas.id_puesto,clinicas.puesto.id,clinicas.puesto.puesto,telefono,direccion,postal',
          },
        },
      )
      .toPromise();
    if (!data) {
      return null;
    } else {
      return this.sessionService.transformarUsuarioDirectus(data.data);
    }
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
      (i) => i.ejercicio.id_ejercicio === e.id_ejercicio,
    );
    if (exists) return; // evita duplicado; si quieres permitir, elimina este guard
    const orden = this.items().length + 1;

    const series = options?.series ?? (parseInt(e.series_defecto) || 3);
    const repeticiones = options?.repeticiones ?? (parseInt(e.repeticiones_defecto) || 12);

    this.items.update((list) => [
      ...list,
      {
        ejercicio: e,
        sort: orden,
        series,
        repeticiones,
        duracion_seg: undefined,
        descanso_seg: 45,
        veces_dia: 1,
        dias_semana: ['L', 'X', 'V'],
      },
    ]);
    this.openDrawer();
  }

  removeEjercicio(ejercicioId: number) {
    this.items.update((list) =>
      list
        .filter((i) => i.ejercicio.id_ejercicio !== ejercicioId)
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
    this.fecha_inicio.set(null);
    this.fecha_fin.set(null);
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

  async submitPlan(): Promise<number | null> {
    if (!this.canSubmit()) throw new Error('Faltan datos');
    const planId = await this.createPlanDeep({
      paciente: this.paciente()!.id,
      fisio: this.fisioId()!,
      titulo: this.titulo() || 'Plan sin título',
      descripcion: this.descripcion() || '',
      fecha_inicio: this.fecha_inicio(),
      fecha_fin: this.fecha_fin(),
      items: this.items().map((i, index) => ({
        ejercicio: i.ejercicio.id_ejercicio,
        sort: index + 1,
        series: i.series,
        repeticiones: i.repeticiones,
        duracion_seg: i.duracion_seg,
        descanso_seg: i.descanso_seg,
        veces_dia: i.veces_dia,
        dias_semana: i.dias_semana,
        instrucciones_paciente: i.instrucciones_paciente,
        notas_fisio: i.notas_fisio,
      })),
    });

    // limpiar storage del plan creado
    const f = this.fisioId(),
      p = this.paciente();
    if (f && p) this.removeFromStorage(f, p.id);

    return planId;
  }

  async createPlanDeep(payload: {
    paciente: ID;
    fisio: string;
    titulo: string;
    descripcion?: string;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    items: {
      ejercicio: number;
      sort: number;
      series?: number;
      repeticiones?: number;
      duracion_seg?: number;
      descanso_seg?: number;
      veces_dia?: number;
      dias_semana?: string[];
      instrucciones_paciente?: string;
      notas_fisio?: string;
      media_personalizada?: string | null;
    }[];
  }): Promise<number | null> {
    try {
      // 1. Crear el plan sin ejercicios
      const planBody = {
        paciente: payload.paciente,
        fisio: payload.fisio,
        titulo: payload.titulo,
        descripcion: payload.descripcion ?? '',
        fecha_inicio: payload.fecha_inicio,
        fecha_fin: payload.fecha_fin,
        estado: 'activo',
      };

      const planResponse = await firstValueFrom(
        this.http.post<{ data: { id_plan: number } }>(
          `${env.DIRECTUS_URL}/items/Planes`,
          planBody,
          { withCredentials: true },
        ),
      );

      if (!planResponse?.data?.id_plan) {
        console.error('Error: No se pudo crear el plan');
        return null;
      }

      const planId = planResponse.data.id_plan;
      console.log('Plan creado con ID:', planId);

      // 2. Crear los ejercicios del plan en planes_ejercicios
      if (payload.items.length > 0) {
        const ejerciciosPayload = payload.items.map((item) => ({
          plan: planId,
          ejercicio: item.ejercicio,
          sort: item.sort,
          series: item.series,
          repeticiones: item.repeticiones,
          duracion_seg: item.duracion_seg,
          descanso_seg: item.descanso_seg,
          veces_dia: item.veces_dia,
          dias_semana: item.dias_semana,
          instrucciones_paciente: item.instrucciones_paciente,
          notas_fisio: item.notas_fisio,
        }));

        // Crear todos los ejercicios en una sola petición (batch create)
        const ejerciciosResponse = await firstValueFrom(
          this.http.post<{ data: unknown[] }>(
            `${env.DIRECTUS_URL}/items/planes_ejercicios`,
            ejerciciosPayload,
            { withCredentials: true },
          ),
        );

        console.log('Ejercicios creados:', ejerciciosResponse?.data?.length ?? 0);
      }

      return planId;
    } catch (error) {
      console.error('Error al crear plan:', error);
      return null;
    }
  }

  // ============================================
  // MODO EDICION
  // ============================================

  setPlanId(id: number | null) {
    this.planId.set(id);
  }

  /**
   * Cargar un plan existente para editar
   */
  async loadPlanForEdit(planId: number): Promise<boolean> {
    const fields = [
      'id_plan',
      'titulo',
      'descripcion',
      'estado',
      'fecha_inicio',
      'fecha_fin',
      'paciente.id',
      'paciente.first_name',
      'paciente.last_name',
      'paciente.email',
      'paciente.avatar',
      'paciente.telefono',
      'paciente.clinicas.id_clinica',
      'paciente.clinicas.id_puesto',
      'fisio.id',
      'ejercicios.id',
      'ejercicios.sort',
      'ejercicios.ejercicio.id_ejercicio',
      'ejercicios.ejercicio.nombre_ejercicio',
      'ejercicios.ejercicio.descripcion',
      'ejercicios.ejercicio.portada',
      'ejercicios.ejercicio.video',
      'ejercicios.ejercicio.series_defecto',
      'ejercicios.ejercicio.repeticiones_defecto',
      'ejercicios.series',
      'ejercicios.repeticiones',
      'ejercicios.duracion_seg',
      'ejercicios.descanso_seg',
      'ejercicios.veces_dia',
      'ejercicios.dias_semana',
      'ejercicios.instrucciones_paciente',
      'ejercicios.notas_fisio',
    ].join(',');

    try {
      const response = await firstValueFrom(
        this.http.get<{ data: PlanDirectus }>(
          `${env.DIRECTUS_URL}/items/Planes/${planId}`,
          {
            params: { fields },
            withCredentials: true,
          },
        ),
      );

      if (!response?.data) return false;

      const plan = response.data;

      // Cargar paciente
      if (plan.paciente && typeof plan.paciente !== 'string') {
        const pacienteData = plan.paciente as UsuarioDirectus;
        this.paciente.set(
          this.sessionService.transformarUsuarioDirectus(pacienteData),
        );
      }

      // Cargar metadatos
      this.planId.set(planId);
      this.titulo.set(plan.titulo || '');
      this.descripcion.set(plan.descripcion || '');
      this.fecha_inicio.set(plan.fecha_inicio || null);
      this.fecha_fin.set(plan.fecha_fin || null);

      // Cargar ejercicios
      const items: EjercicioPlan[] = (plan.ejercicios || [])
        .map((item: EjercicioPlanDirectus) => ({
          id: item.id,
          sort: item.sort,
          plan: planId,
          ejercicio: item.ejercicio as Ejercicio,
          series: item.series,
          repeticiones: item.repeticiones,
          duracion_seg: item.duracion_seg,
          descanso_seg: item.descanso_seg,
          veces_dia: item.veces_dia,
          dias_semana: item.dias_semana,
          instrucciones_paciente: item.instrucciones_paciente,
          notas_fisio: item.notas_fisio,
        }))
        .sort((a: EjercicioPlan, b: EjercicioPlan) => a.sort - b.sort);

      this.items.set(items);

      return true;
    } catch (error) {
      console.error('Error al cargar plan para editar:', error);
      return false;
    }
  }

  /**
   * Actualizar un plan existente
   */
  async updatePlan(): Promise<number | null> {
    const id = this.planId();
    if (!id || !this.canSubmit())
      throw new Error('Faltan datos para actualizar');

    try {
      // 1. Actualizar metadatos del plan
      await firstValueFrom(
        this.http.patch(
          `${env.DIRECTUS_URL}/items/Planes/${id}`,
          {
            titulo: this.titulo() || 'Plan sin título',
            descripcion: this.descripcion() || '',
            fecha_inicio: this.fecha_inicio(),
            fecha_fin: this.fecha_fin(),
          },
          { withCredentials: true },
        ),
      );

      // 2. Eliminar ejercicios existentes
      const existingItems = this.items().filter((i) => i.id);
      const existingIds = existingItems.map((i) => i.id);

      // Obtener IDs actuales en la BD
      const currentResponse = await firstValueFrom(
        this.http.get<{ data: { id: number }[] }>(
          `${env.DIRECTUS_URL}/items/planes_ejercicios`,
          {
            params: {
              filter: JSON.stringify({ plan: { _eq: id } }),
              fields: 'id',
            },
            withCredentials: true,
          },
        ),
      );

      const currentIds = (currentResponse?.data || []).map((i) => i.id);
      const idsToDelete = currentIds.filter(
        (cid) => !existingIds.includes(cid),
      );

      // Eliminar los que ya no estan
      for (const delId of idsToDelete) {
        await firstValueFrom(
          this.http.delete(
            `${env.DIRECTUS_URL}/items/planes_ejercicios/${delId}`,
            {
              withCredentials: true,
            },
          ),
        );
      }

      // 3. Actualizar/Crear ejercicios
      for (let i = 0; i < this.items().length; i++) {
        const item = this.items()[i];
        const payload = {
          plan: id,
          ejercicio: item.ejercicio.id_ejercicio,
          sort: i + 1,
          series: item.series,
          repeticiones: item.repeticiones,
          duracion_seg: item.duracion_seg,
          descanso_seg: item.descanso_seg,
          veces_dia: item.veces_dia,
          dias_semana: item.dias_semana,
          instrucciones_paciente: item.instrucciones_paciente,
          notas_fisio: item.notas_fisio,
        };

        if (item.id) {
          // Actualizar existente
          await firstValueFrom(
            this.http.patch(
              `${env.DIRECTUS_URL}/items/planes_ejercicios/${item.id}`,
              payload,
              { withCredentials: true },
            ),
          );
        } else {
          // Crear nuevo
          await firstValueFrom(
            this.http.post(
              `${env.DIRECTUS_URL}/items/planes_ejercicios`,
              payload,
              { withCredentials: true },
            ),
          );
        }
      }

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
  // RUTINAS (Plantillas)
  // ============================================

  /**
   * Cargar ejercicios desde una rutina
   */
  async loadFromRutina(rutinaId: number): Promise<boolean> {
    try {
      const rutina = await this.rutinasService.getRutinaById(rutinaId);
      if (!rutina) return false;

      // Convertir ejercicios de rutina a ejercicios de plan
      const items: EjercicioPlan[] = rutina.ejercicios.map((e, idx) => ({
        sort: idx + 1,
        ejercicio: e.ejercicio,
        series: e.series ?? 3,
        repeticiones: e.repeticiones ?? 12,
        duracion_seg: e.duracion_seg,
        descanso_seg: e.descanso_seg ?? 45,
        veces_dia: e.veces_dia ?? 1,
        dias_semana: e.dias_semana ?? ['L', 'X', 'V'],
        instrucciones_paciente: e.instrucciones_paciente,
        notas_fisio: e.notas_fisio,
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
  ): Promise<number | null> {
    const fisio = this.fisioId();
    if (!fisio || this.items().length === 0) return null;

    const payload: CreateRutinaPayload = {
      nombre,
      descripcion,
      autor: fisio,
      visibilidad,
      ejercicios: this.items().map((item, idx) => ({
        ejercicio: item.ejercicio.id_ejercicio,
        sort: idx + 1,
        series: item.series,
        repeticiones: item.repeticiones,
        duracion_seg: item.duracion_seg,
        descanso_seg: item.descanso_seg,
        veces_dia: item.veces_dia,
        dias_semana: item.dias_semana,
        instrucciones_paciente: item.instrucciones_paciente,
        notas_fisio: item.notas_fisio,
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
    this.fecha_inicio.set(null);
    this.fecha_fin.set(null);
    // Mantener paciente si existe
  }

  /**
   * Reset completo incluyendo paciente
   */
  resetAll() {
    this.resetForNewPlan();
    this.paciente.set(null);
    this.closeDrawer();
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
    this.fecha_inicio.set(null);
    this.fecha_fin.set(null);
    this.openDrawer();
  }

  /**
   * Sale del modo rutina y vuelve a modo plan
   */
  exitRutinaMode() {
    this.clearRutinaStorage();
    this.mode.set('plan');
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
}
