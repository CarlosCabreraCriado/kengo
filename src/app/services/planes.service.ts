import {
  Injectable,
  computed,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment as env } from '../../environments/environment';
import { AppService } from './app.service';

import {
  Plan,
  PlanDirectus,
  PlanCompleto,
  EjercicioPlan,
  EjercicioPlanDirectus,
  EstadoPlan,
  Usuario,
  Ejercicio,
} from '../../types/global';

interface PlanesResponse {
  data: PlanDirectus[];
  meta?: { filter_count?: number };
}

interface PlanResponse {
  data: PlanDirectus;
}

type FiltroEstado = 'todos' | EstadoPlan;

@Injectable({ providedIn: 'root' })
export class PlanesService {
  private http = inject(HttpClient);
  private appService = inject(AppService);

  // --- Filtros como signals ---
  readonly busqueda: WritableSignal<string> = signal('');
  readonly filtroEstado: WritableSignal<FiltroEstado> = signal('todos');
  readonly filtroPaciente: WritableSignal<string | null> = signal(null);
  readonly page: WritableSignal<number> = signal(1);
  readonly pageSize: WritableSignal<number> = signal(20);

  // ID del usuario actual (fisio)
  private readonly usuarioId = computed(() => this.appService.usuario()?.id ?? null);

  // Request para listar planes
  private readonly peticionPlanes = () => {
    const userId = this.usuarioId();
    if (!userId) return undefined;

    const titulo = this.busqueda().trim();
    const estado = this.filtroEstado();
    const pacienteId = this.filtroPaciente();
    const p = this.page();
    const ps = this.pageSize();

    // Filtro base: planes del fisio actual
    const filterConditions: Record<string, unknown>[] = [
      { fisio: { _eq: userId } },
    ];

    // Filtro por estado
    if (estado !== 'todos') {
      filterConditions.push({ estado: { _eq: estado } });
    }

    // Filtro por paciente
    if (pacienteId) {
      filterConditions.push({ paciente: { _eq: pacienteId } });
    }

    // Filtro por titulo
    if (titulo) {
      filterConditions.push({ titulo: { _icontains: titulo } });
    }

    const filter = { _and: filterConditions };

    return {
      url: `${env.DIRECTUS_URL}/items/Planes`,
      method: 'GET',
      params: {
        fields: [
          'id_plan',
          'titulo',
          'descripcion',
          'estado',
          'fecha_inicio',
          'fecha_fin',
          'date_created',
          'date_updated',
          'paciente.id',
          'paciente.first_name',
          'paciente.last_name',
          'paciente.email',
          'paciente.avatar',
        ].join(','),
        limit: String(ps),
        offset: String((p - 1) * ps),
        sort: '-date_created',
        meta: 'filter_count',
        filter: JSON.stringify(filter),
      },
    };
  };

  readonly planesRes = httpResource<Plan[]>(this.peticionPlanes, {
    parse: (res) => {
      const resultado = res as PlanesResponse;
      return resultado.data.map((p) => this.transformPlan(p));
    },
    defaultValue: [],
  });

  // Computed para la vista
  readonly planes = computed(() => this.planesRes.value());
  readonly isLoading = computed(() => this.planesRes.isLoading());
  readonly total = computed(() => {
    const res = this.planesRes.value();
    return Array.isArray(res) ? res.length : 0;
  });

  // ========= Acciones (mutadores) =========

  setBusqueda(v: string) {
    this.busqueda.set(v);
    this.page.set(1);
  }

  setFiltroEstado(v: FiltroEstado) {
    this.filtroEstado.set(v);
    this.page.set(1);
  }

  setFiltroPaciente(id: string | null) {
    this.filtroPaciente.set(id);
    this.page.set(1);
  }

  clearFilters() {
    this.busqueda.set('');
    this.filtroEstado.set('todos');
    this.filtroPaciente.set(null);
    this.page.set(1);
  }

  goToPage(p: number) {
    this.page.set(Math.max(1, p));
  }

  reload() {
    this.planesRes.reload();
  }

  // ========= CRUD Methods =========

  /**
   * Obtener un plan por ID con todos sus ejercicios
   */
  async getPlanById(id: number): Promise<PlanCompleto | null> {
    const fields = [
      'id_plan',
      'titulo',
      'descripcion',
      'estado',
      'fecha_inicio',
      'fecha_fin',
      'date_created',
      'date_updated',
      'paciente.id',
      'paciente.first_name',
      'paciente.last_name',
      'paciente.email',
      'paciente.avatar',
      'paciente.telefono',
      'fisio.id',
      'fisio.first_name',
      'fisio.last_name',
      'fisio.email',
      'items.id',
      'items.sort',
      'items.ejercicio.id_ejercicio',
      'items.ejercicio.nombre_ejercicio',
      'items.ejercicio.descripcion',
      'items.ejercicio.portada',
      'items.ejercicio.video',
      'items.ejercicio.series_defecto',
      'items.ejercicio.repeticiones_defecto',
      'items.series',
      'items.repeticiones',
      'items.duracion_seg',
      'items.descanso_seg',
      'items.veces_dia',
      'items.dias_semana',
      'items.instrucciones_paciente',
      'items.notas_fisio',
    ].join(',');

    try {
      const response = await firstValueFrom(
        this.http.get<PlanResponse>(`${env.DIRECTUS_URL}/items/Planes/${id}`, {
          params: { fields },
          withCredentials: true,
        })
      );

      if (!response?.data) return null;

      return this.transformPlanCompleto(response.data);
    } catch (error) {
      console.error('Error al obtener plan:', error);
      return null;
    }
  }

  /**
   * Actualizar el estado de un plan
   */
  async updateEstado(id: number, estado: EstadoPlan): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.patch(
          `${env.DIRECTUS_URL}/items/Planes/${id}`,
          { estado },
          { withCredentials: true }
        )
      );

      this.reload();
      return true;
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return false;
    }
  }

  /**
   * Actualizar un plan completo (metadatos)
   */
  async updatePlan(
    id: number,
    payload: Partial<{
      titulo: string;
      descripcion: string;
      fecha_inicio: string | null;
      fecha_fin: string | null;
      estado: EstadoPlan;
    }>
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.patch(
          `${env.DIRECTUS_URL}/items/Planes/${id}`,
          payload,
          { withCredentials: true }
        )
      );

      this.reload();
      return true;
    } catch (error) {
      console.error('Error al actualizar plan:', error);
      return false;
    }
  }

  /**
   * Eliminar un plan (soft delete via estado)
   */
  async deletePlan(id: number): Promise<boolean> {
    return this.updateEstado(id, 'cancelado');
  }

  /**
   * Eliminar un plan permanentemente
   */
  async deletePlanPermanente(id: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${env.DIRECTUS_URL}/items/Planes/${id}`, {
          withCredentials: true,
        })
      );

      this.reload();
      return true;
    } catch (error) {
      console.error('Error al eliminar plan:', error);
      return false;
    }
  }

  // ========= Planes por paciente (para perfil) =========

  /**
   * Obtener planes de un paciente especifico
   */
  async getPlanesByPaciente(pacienteId: string): Promise<Plan[]> {
    const filter = {
      _and: [
        { paciente: { _eq: pacienteId } },
        { estado: { _neq: 'cancelado' } },
      ],
    };

    try {
      const response = await firstValueFrom(
        this.http.get<PlanesResponse>(`${env.DIRECTUS_URL}/items/Planes`, {
          params: {
            fields: [
              'id_plan',
              'titulo',
              'descripcion',
              'estado',
              'fecha_inicio',
              'fecha_fin',
              'date_created',
              'fisio.id',
              'fisio.first_name',
              'fisio.last_name',
            ].join(','),
            sort: '-date_created',
            filter: JSON.stringify(filter),
          },
          withCredentials: true,
        })
      );

      return (response?.data || []).map((p) => this.transformPlan(p));
    } catch (error) {
      console.error('Error al obtener planes del paciente:', error);
      return [];
    }
  }

  // ========= Transformers =========

  private transformPlan(p: PlanDirectus): Plan {
    return {
      id_plan: p.id_plan,
      paciente: this.transformUsuario(p.paciente),
      fisio: this.transformUsuario(p.fisio),
      titulo: p.titulo,
      descripcion: p.descripcion,
      estado: p.estado,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin,
      date_created: p.date_created,
      date_updated: p.date_updated,
    };
  }

  private transformPlanCompleto(p: PlanDirectus): PlanCompleto {
    return {
      id_plan: p.id_plan,
      paciente: this.appService.transformarUsuarioDirectus(p.paciente as any),
      fisio: this.appService.transformarUsuarioDirectus(p.fisio as any),
      titulo: p.titulo,
      descripcion: p.descripcion,
      estado: p.estado,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin,
      date_created: p.date_created,
      date_updated: p.date_updated,
      items: (p.items || [])
        .map((e) => this.transformEjercicioPlan(e))
        .sort((a, b) => a.sort - b.sort),
    };
  }

  private transformUsuario(u: string | any): string | Usuario {
    if (typeof u === 'string') return u;
    if (!u) return '';
    // Si es objeto con datos basicos
    return {
      id: u.id,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
      avatar: u.avatar || '',
      detalle: null,
      clinicas: [],
      esFisio: false,
      esPaciente: true,
    };
  }

  private transformEjercicioPlan(e: EjercicioPlanDirectus): EjercicioPlan {
    return {
      id: e.id,
      sort: e.sort,
      plan: e.plan,
      ejercicio: e.ejercicio as Ejercicio,
      series: e.series,
      repeticiones: e.repeticiones,
      duracion_seg: e.duracion_seg,
      descanso_seg: e.descanso_seg,
      veces_dia: e.veces_dia,
      dias_semana: e.dias_semana,
      instrucciones_paciente: e.instrucciones_paciente,
      notas_fisio: e.notas_fisio,
      date_created: e.date_created,
      data_updated: e.date_updated,
    };
  }

  // ========= Helper de assets =========
  getAssetUrl(id?: string, width = 200, height = 200) {
    return id
      ? `${env.DIRECTUS_URL}/assets/${id}?width=${width}&height=${height}&fit=cover&format=webp`
      : '';
  }
}
