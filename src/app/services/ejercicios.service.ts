import {
  Injectable,
  computed,
  inject,
  signal,
  untracked,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import { httpResource } from '@angular/common/http';

import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable, firstValueFrom } from 'rxjs';
import { environment as env } from '../../environments/environment';
import { AppService } from './app.service';

//Tipos:
import { Ejercicio } from '../../types/global';

interface ExerciseQuery {
  name?: string;
  categoryIds?: (string | number)[];
  page: number;
  pageSize: number;
  sort?: string;
}

export interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
}

export interface PaginaEjercicios {
  data: Ejercicio[];
  meta: { total_count?: number; filter_count?: number };
}

export interface DirectusItem<T> {
  data: T;
}

export interface PeticionCategoria {
  data: Categoria[];
}

interface FiltroEjercicios {
  nombre_ejercicio?: { _icontains: string };
  categoria?: { categorias_id_categoria: { _in: (string | number)[] } };
  id_ejercicio?: { _in: number[] };
}

@Injectable({ providedIn: 'root' })
export class EjerciciosService {
  private http = inject(HttpClient);
  private appService = inject(AppService);

  // --- Filtros / paginación como señales puras ---
  readonly busqueda: WritableSignal<string> = signal('');
  readonly idsCategoriasSeleccionadas: WritableSignal<(string | number)[]> =
    signal([]);
  readonly page: WritableSignal<number> = signal(1);
  readonly pageSize: WritableSignal<number> = signal(24);
  readonly sort: WritableSignal<string> = signal('nombre_ejercicio');

  // --- Favoritos ---
  readonly idsFavoritos: WritableSignal<Set<number>> = signal(new Set());
  readonly soloFavoritos: WritableSignal<boolean> = signal(false);
  readonly favoritoEnProceso: WritableSignal<number | null> = signal(null);

  // Query derivada para exercises
  private readonly query: Signal<ExerciseQuery> = computed(() => ({
    name: this.busqueda().trim() || undefined,
    categoryIds: this.idsCategoriasSeleccionadas(),
    page: this.page(),
    pageSize: this.pageSize(),
    sort: this.sort(),
  }));

  readonly categoriasRes = httpResource<Categoria[]>(
    () => {
      const req = {
        url: `${env.DIRECTUS_URL}/items/categorias`,
        method: 'GET',
        params: {
          fields: 'id_categoria,nombre_categoria',
          limit: '200',
          sort: 'nombre_categoria',
        },
        transferCache: true,
      };
      return req;
    },
    {
      parse: (res) => {
        const resultado = res as PeticionCategoria;
        console.log('Categorias: ', resultado.data);
        return resultado.data;
      },
    },
  );

  findInCacheById(id: string | number) {
    const idStr = String(id);
    return this.listaEjerciciosRes
      .value()
      .data.find((e) => String(e.id_ejercicio) === idStr);
  }

  /** Petición puntual a Directus para un ejercicio por id */
  getEjercicioById$(id: string | number): Observable<Ejercicio> {
    const params = new HttpParams().set(
      'fields',
      'id_ejercicio,nombre_ejercicio,descripcion,portada,video,categoria,series_defecto,repeticiones_defecto',
    );
    return this.http
      .get<DirectusItem<Ejercicio>>(
        `${env.DIRECTUS_URL}/items/ejercicios/${id}`,
        {
          params,
          // withCredentials: true, // si usas cookie/session en vez de Bearer
        },
      )
      .pipe(map((res) => res.data));
  }

  private readonly peticionEjercicios = () => {
    const name = this.busqueda().trim();
    const cats = this.idsCategoriasSeleccionadas();
    const p = this.page();
    const ps = this.pageSize();
    const so = this.sort();
    const soloFavs = this.soloFavoritos();

    const filter: FiltroEjercicios = {};
    if (name) filter['nombre_ejercicio'] = { _icontains: name };

    if (cats.length) {
      filter['categoria'] = { categorias_id_categoria: { _in: cats } };
    }

    // Filtro de favoritos - solo crear dependencia reactiva si está activo
    if (soloFavs) {
      const favIds = this.idsFavoritos();
      if (favIds.size > 0) {
        filter['id_ejercicio'] = { _in: [...favIds] };
      } else {
        // Sin favoritos, devolver array vacío
        filter['id_ejercicio'] = { _in: [-1] };
      }
    }

    return {
      url: `${env.DIRECTUS_URL}/items/ejercicios`,
      method: 'GET',
      params: {
        fields:
          'id_ejercicio,nombre_ejercicio,descripcion,portada,video,categoria.*,series_defecto,repeticiones_defecto',
        limit: String(ps),
        offset: String((p - 1) * ps),
        sort: so,
        meta: 'filter_count',
        ...(Object.keys(filter).length
          ? { filter: JSON.stringify(filter) }
          : {}),
      },
      transferCache: true,
    };
  };

  readonly listaEjerciciosRes = httpResource<PaginaEjercicios>(
    this.peticionEjercicios,
    {
      parse: (res) => {
        const resultado = res as PaginaEjercicios;
        console.log('Ejercicios paginados: ', resultado);
        return resultado;
      },
      defaultValue: { data: [], meta: {} },
    },
  );

  // ========= Derivados (computed) para la vista =========
  readonly ejercicios = computed(() => this.listaEjerciciosRes.value().data);
  readonly total = computed(
    () => this.listaEjerciciosRes.value().meta?.filter_count ?? 0,
  );
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );
  readonly hasActiveFilters = computed(
    () =>
      !!this.busqueda().trim() ||
      this.idsCategoriasSeleccionadas().length > 0 ||
      this.soloFavoritos(),
  );

  // ========= Recargas manuales =========
  reloadEjercicios() {
    this.listaEjerciciosRes.reload();
  }

  reloadCategorias() {
    this.categoriasRes.reload();
  }

  // ========= Acciones (mutadores) =========
  setBusqueda(v: string) {
    this.busqueda.set(v);
    this.page.set(1);
  }

  toggleCategoria(id: string | number) {
    const set = new Set(this.idsCategoriasSeleccionadas());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.idsCategoriasSeleccionadas.set([...set]);
    this.page.set(1);
  }

  limpiarCategorias() {
    this.idsCategoriasSeleccionadas.set([]);
    this.page.set(1);
  }

  clearFilters() {
    this.busqueda.set('');
    this.idsCategoriasSeleccionadas.set([]);
    this.soloFavoritos.set(false);
    this.page.set(1);
  }

  setSort(s: 'nombre_ejercicio' | '-nombre_ejercicio') {
    this.sort.set(s);
    this.page.set(1);
  }

  setPageSize(n: number) {
    this.pageSize.set(n);
    this.page.set(1);
  }

  goToPage(p: number) {
    const max = this.pageSize();
    this.page.set(Math.min(Math.max(1, p), max));
  }

  // ========= Helper de assets (ajusta si usas tokens/cookies/blob) =========
  getAssetUrl(id?: string) {
    return id ? `${env.DIRECTUS_URL}/assets/${id}` : '';
  }

  // ========= Favoritos =========

  async cargarFavoritos(): Promise<void> {
    const usuario = this.appService.usuario();
    if (!usuario) return;

    try {
      const res = await firstValueFrom(
        this.http.get<{ data: { id_ejercicio: number }[] }>(
          `${env.DIRECTUS_URL}/items/ejercicios_favoritos`,
          {
            params: {
              filter: JSON.stringify({
                id_usuario: { _eq: usuario.id },
              }),
              fields: 'id_ejercicio',
              limit: '1000',
            },
            withCredentials: true,
          },
        ),
      );

      const ids = new Set(res.data.map((f) => f.id_ejercicio));
      this.idsFavoritos.set(ids);
    } catch (error) {
      console.error('Error cargando favoritos:', error);
    }
  }

  async toggleFavorito(idEjercicio: number): Promise<void> {
    const usuario = this.appService.usuario();
    if (!usuario) return;

    const esFavorito = this.idsFavoritos().has(idEjercicio);
    this.favoritoEnProceso.set(idEjercicio);

    // Optimistic update
    const nuevoSet = new Set(this.idsFavoritos());
    if (esFavorito) {
      nuevoSet.delete(idEjercicio);
    } else {
      nuevoSet.add(idEjercicio);
    }
    this.idsFavoritos.set(nuevoSet);

    try {
      if (esFavorito) {
        await this.eliminarFavorito(usuario.id, idEjercicio);
      } else {
        await this.agregarFavorito(usuario.id, idEjercicio);
      }
    } catch (error) {
      console.error('Error toggling favorito:', error);
      // Revertir optimistic update
      const revertSet = new Set(this.idsFavoritos());
      if (esFavorito) {
        revertSet.add(idEjercicio);
      } else {
        revertSet.delete(idEjercicio);
      }
      this.idsFavoritos.set(revertSet);
    } finally {
      this.favoritoEnProceso.set(null);
    }
  }

  private async agregarFavorito(
    userId: string,
    ejercicioId: number,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${env.DIRECTUS_URL}/items/ejercicios_favoritos`,
        {
          id_usuario: userId,
          id_ejercicio: ejercicioId,
        },
        { withCredentials: true },
      ),
    );
  }

  private async eliminarFavorito(
    userId: string,
    ejercicioId: number,
  ): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<{ data: { id: number }[] }>(
        `${env.DIRECTUS_URL}/items/ejercicios_favoritos`,
        {
          params: {
            filter: JSON.stringify({
              id_usuario: { _eq: userId },
              id_ejercicio: { _eq: ejercicioId },
            }),
            fields: 'id',
            limit: '1',
          },
          withCredentials: true,
        },
      ),
    );

    if (res.data.length > 0) {
      await firstValueFrom(
        this.http.delete(
          `${env.DIRECTUS_URL}/items/ejercicios_favoritos/${res.data[0].id}`,
          { withCredentials: true },
        ),
      );
    }
  }

  esFavorito(idEjercicio: number): boolean {
    return this.idsFavoritos().has(idEjercicio);
  }

  toggleSoloFavoritos(): void {
    this.soloFavoritos.update((v) => !v);
    this.page.set(1);
  }
}
