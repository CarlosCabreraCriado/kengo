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

import { Router } from '@angular/router';
import { AppService } from '../services/app.service';
import { environment as env } from '../../environments/environment';
import {
  UsuarioDirectus,
  Usuario,
  ID,
  Ejercicio,
  EjercicioPlan,
} from '../../types/global';

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

//Persistencia localStorage
const STORAGE_PREFIX = 'kengo:plan_builder:v1:';
const storageKey = (fisioId: string, pacienteId: string) =>
  `${STORAGE_PREFIX}f=${fisioId}:p=${pacienteId}`;
const DEFAULT_TTL_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class PlanBuilderService {
  private http = inject(HttpClient);
  private appService = inject(AppService);
  private router = inject(Router);
  private injector = inject(Injector);

  readonly paciente = signal<Usuario | null>(null);

  readonly fisioId = computed(() => {
    const usuario = this.appService.usuario();
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

        const _ = [
          this.titulo(),
          this.descripcion(),
          this.fecha_inicio(),
          this.fecha_fin(),
          ...this.items(), // ojo: si es array de objetos, el trigger será por referencia; suele bastar
        ];
        // si no hay paciente/fisio no guardamos
        if (!p || !f) return;
        this.scheduleSave(350); // guarda a los ~350ms de la última edición
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
              'id,first_name,last_name,email,avatar,clinicas.id_clinica,clinicas.puestos.Puestos_id.puesto,clinicas.puestos.Puestos_id.id,is_cliente,is_fisio,telefono,direccion,postal',
          },
        },
      )
      .toPromise();
    if (!data) {
      return null;
    } else {
      return this.appService.transformarUsuarioDirectus(data.data);
    }
  }

  cambiarPaciente(p: Usuario | null) {
    if (!p) {
      this.clear();
      this.paciente.set(null);
      this.router.navigate(['/inicio/mis-pacientes']);
      this.closeDrawer();
    } else {
      this.paciente.set(p);
      this.tryRestoreFor(p.id);
      localStorage.setItem('carrito:last_paciente_id', p.id);
      this.router.navigate(['/inicio/ejercicios']);
      this.openDrawer();
    }
  }

  addEjercicio(e: Ejercicio) {
    const exists = this.items().some(
      (i) => i.ejercicio.id_ejercicio === e.id_ejercicio,
    );
    if (exists) return; // evita duplicado; si quieres permitir, elimina este guard
    const orden = this.items().length + 1;
    this.items.update((list) => [
      ...list,
      {
        ejercicio: e,
        sort: orden,
        series: 3,
        repeticiones: 12,
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
        .map((i, idx) => ({ ...i, orden: idx + 1 })),
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
    this.items.set(arr.map((i, idx) => ({ ...i, orden: idx + 1 })));
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
        orden: index + 1,
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
      orden: number;
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
    const body = {
      paciente: payload.paciente,
      fisio: payload.fisio,
      titulo: payload.titulo,
      descripcion: payload.descripcion ?? '',
      fecha_inicio: payload.fecha_inicio,
      fecha_fin: payload.fecha_fin,
      items: payload.items, // deep create O2M
      estado: 'activo',
    };
    const data = await this.http
      .post<{
        id_plan: number;
      }>(`${env.DIRECTUS_URL}/items/planes`, body, { withCredentials: true })
      .toPromise();
    if (!data) {
      return null;
    } else {
      return data.id_plan; // id del plan creado
    }
  }
}
