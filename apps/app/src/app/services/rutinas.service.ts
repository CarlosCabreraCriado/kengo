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
  Rutina,
  RutinaDirectus,
  RutinaCompleta,
  EjercicioRutina,
  EjercicioRutinaDirectus,
  CreateRutinaPayload,
  VisibilidadRutina,
  Ejercicio,
} from '../../types/global';

interface RutinasResponse {
  data: RutinaDirectus[];
  meta?: { filter_count?: number };
}

interface RutinaResponse {
  data: RutinaDirectus;
}

type FiltroVisibilidad = 'todas' | 'privadas' | 'publicas';

@Injectable({ providedIn: 'root' })
export class RutinasService {
  private http = inject(HttpClient);
  private appService = inject(AppService);

  // --- Filtros como signals ---
  readonly busqueda: WritableSignal<string> = signal('');
  readonly filtroVisibilidad: WritableSignal<FiltroVisibilidad> = signal('todas');
  readonly page: WritableSignal<number> = signal(1);
  readonly pageSize: WritableSignal<number> = signal(20);

  // ID del usuario actual (fisio)
  private readonly usuarioId = computed(() => this.appService.usuario()?.id ?? null);

  // Request para listar rutinas
  private readonly peticionRutinas = () => {
    const userId = this.usuarioId();
    if (!userId) return undefined; // No cargar si no hay usuario

    const nombre = this.busqueda().trim();
    const vis = this.filtroVisibilidad();
    const p = this.page();
    const ps = this.pageSize();

    // Filtro: mis rutinas privadas + todas las publicas
    // O segun el filtro seleccionado
    const filter: Record<string, unknown> = {};

    if (vis === 'privadas') {
      // Solo mis rutinas privadas
      filter['_and'] = [
        { autor: { _eq: userId } },
        { visibilidad: { _eq: 'privado' } },
      ];
    } else if (vis === 'publicas') {
      // Solo rutinas publicas
      filter['visibilidad'] = { _eq: 'publico' };
    } else {
      // Todas: mis privadas + todas las publicas
      filter['_or'] = [
        { autor: { _eq: userId } },
        { visibilidad: { _eq: 'publico' } },
      ];
    }

    if (nombre) {
      // Agregar filtro de nombre
      const nombreFilter = { nombre: { _icontains: nombre } };
      if (filter['_and']) {
        (filter['_and'] as unknown[]).push(nombreFilter);
      } else if (filter['_or']) {
        filter['_and'] = [{ _or: filter['_or'] }, nombreFilter];
        delete filter['_or'];
      } else {
        filter['nombre'] = { _icontains: nombre };
      }
    }

    return {
      url: `${env.DIRECTUS_URL}/items/rutinas`,
      method: 'GET',
      params: {
        fields: 'id_rutina,nombre,descripcion,autor,visibilidad,date_created,date_updated',
        limit: String(ps),
        offset: String((p - 1) * ps),
        sort: '-date_created',
        meta: 'filter_count',
        filter: JSON.stringify(filter),
      },
    };
  };

  readonly rutinasRes = httpResource<Rutina[]>(this.peticionRutinas, {
    parse: (res) => {
      const resultado = res as RutinasResponse;
      return resultado.data.map((r) => this.transformRutina(r));
    },
    defaultValue: [],
  });

  // Computed para la vista
  readonly rutinas = computed(() => this.rutinasRes.value());
  readonly isLoading = computed(() => this.rutinasRes.isLoading());
  readonly total = computed(() => {
    const res = this.rutinasRes.value();
    return Array.isArray(res) ? res.length : 0;
  });

  // ========= Acciones (mutadores) =========

  setBusqueda(v: string) {
    this.busqueda.set(v);
    this.page.set(1);
  }

  setFiltroVisibilidad(v: FiltroVisibilidad) {
    this.filtroVisibilidad.set(v);
    this.page.set(1);
  }

  goToPage(p: number) {
    this.page.set(Math.max(1, p));
  }

  reload() {
    this.rutinasRes.reload();
  }

  // ========= CRUD Methods =========

  /**
   * Obtener una rutina por ID con sus ejercicios
   */
  async getRutinaById(id: number): Promise<RutinaCompleta | null> {
    const fields = [
      'id_rutina',
      'nombre',
      'descripcion',
      'autor.id',
      'autor.first_name',
      'autor.last_name',
      'autor.email',
      'autor.avatar',
      'visibilidad',
      'date_created',
      'date_updated',
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
        this.http.get<RutinaResponse>(`${env.DIRECTUS_URL}/items/rutinas/${id}`, {
          params: { fields },
          withCredentials: true,
        })
      );

      if (!response?.data) return null;

      const rutina = response.data;
      return {
        id_rutina: rutina.id_rutina,
        nombre: rutina.nombre,
        descripcion: rutina.descripcion,
        autor: this.appService.transformarUsuarioDirectus(rutina.autor as any),
        visibilidad: rutina.visibilidad,
        date_created: rutina.date_created,
        date_updated: rutina.date_updated,
        ejercicios: (rutina.ejercicios || []).map((e) =>
          this.transformEjercicioRutina(e)
        ),
      };
    } catch (error) {
      console.error('Error al obtener rutina:', error);
      return null;
    }
  }

  /**
   * Crear una nueva rutina
   */
  async createRutina(payload: CreateRutinaPayload): Promise<number | null> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ data: { id_rutina: number } }>(
          `${env.DIRECTUS_URL}/items/rutinas`,
          {
            nombre: payload.nombre,
            descripcion: payload.descripcion || '',
            autor: payload.autor,
            visibilidad: payload.visibilidad,
            ejercicios: payload.ejercicios,
          },
          { withCredentials: true }
        )
      );

      this.reload();
      return response?.data?.id_rutina ?? null;
    } catch (error) {
      console.error('Error al crear rutina:', error);
      return null;
    }
  }

  /**
   * Actualizar una rutina existente
   */
  async updateRutina(
    id: number,
    payload: Partial<{
      nombre: string;
      descripcion: string;
      visibilidad: VisibilidadRutina;
    }>
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.patch(
          `${env.DIRECTUS_URL}/items/rutinas/${id}`,
          payload,
          { withCredentials: true }
        )
      );

      this.reload();
      return true;
    } catch (error) {
      console.error('Error al actualizar rutina:', error);
      return false;
    }
  }

  /**
   * Eliminar una rutina
   */
  async deleteRutina(id: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${env.DIRECTUS_URL}/items/rutinas/${id}`, {
          withCredentials: true,
        })
      );

      this.reload();
      return true;
    } catch (error) {
      console.error('Error al eliminar rutina:', error);
      return false;
    }
  }

  /**
   * Duplicar una rutina
   */
  async duplicarRutina(id: number, nuevoNombre: string): Promise<number | null> {
    const original = await this.getRutinaById(id);
    if (!original) return null;

    const userId = this.usuarioId();
    if (!userId) return null;

    return this.createRutina({
      nombre: nuevoNombre,
      descripcion: original.descripcion,
      autor: userId,
      visibilidad: 'privado', // Las copias siempre empiezan como privadas
      ejercicios: original.ejercicios.map((e, idx) => ({
        ejercicio: e.ejercicio.id_ejercicio,
        sort: idx + 1,
        series: e.series,
        repeticiones: e.repeticiones,
        duracion_seg: e.duracion_seg,
        descanso_seg: e.descanso_seg,
        veces_dia: e.veces_dia,
        dias_semana: e.dias_semana,
        instrucciones_paciente: e.instrucciones_paciente,
        notas_fisio: e.notas_fisio,
      })),
    });
  }

  // ========= Transformers =========

  private transformRutina(r: RutinaDirectus): Rutina {
    return {
      id_rutina: r.id_rutina,
      nombre: r.nombre,
      descripcion: r.descripcion,
      autor: typeof r.autor === 'string' ? r.autor : r.autor?.id || '',
      visibilidad: r.visibilidad,
      date_created: r.date_created,
      date_updated: r.date_updated,
    };
  }

  private transformEjercicioRutina(e: EjercicioRutinaDirectus): EjercicioRutina {
    return {
      id: e.id,
      sort: e.sort,
      rutina: e.rutina,
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
      date_updated: e.date_updated,
    };
  }

  // ========= Helper de assets =========
  getAssetUrl(id?: string, width = 200, height = 200) {
    return id
      ? `${env.DIRECTUS_URL}/assets/${id}?width=${width}&height=${height}&fit=cover&format=webp`
      : '';
  }
}
