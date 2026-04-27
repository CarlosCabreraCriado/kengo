import {
  Injectable,
  computed,
  effect,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { rawAssetUrl, videoUrl } from '../../../core/utils/asset-url';

import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConvexService } from '../../../core/convex/convex.service';
import { mapId } from '../../../shared/utils/convex-mappers';
import { createFilteredList } from '../../../shared/data-access/create-filtered-list';
import { api } from '../../../../../../../convex/_generated/api';

import { Ejercicio, Categoria } from '../../../../types/global';

export interface PaginaEjercicios {
  data: Ejercicio[];
  meta: { total_count?: number; filter_count?: number };
}

@Injectable({ providedIn: 'root' })
export class EjerciciosService {
  private convex = inject(ConvexService);

  // --- Filtros específicos del dominio (los signals base vienen del factory) ---
  readonly idsCategoriasSeleccionadas: WritableSignal<string[]> = signal([]);
  readonly sort: WritableSignal<string> = signal('nombre');

  // --- Favoritos (Convex IDs) ---
  readonly idsFavoritos: WritableSignal<Set<string>> = signal(new Set());
  readonly soloFavoritos: WritableSignal<boolean> = signal(false);
  readonly favoritoEnProceso: WritableSignal<string | null> = signal(null);

  // Suscripción a favoritos via Convex (devuelve Convex exercise IDs)
  private readonly favoritesQuery = this.convex.watchQuery(
    api.exercises.queries.listFavorites,
    () => ({}),
  );

  constructor() {
    effect(() => {
      const convexFavIds = this.favoritesQuery.value();
      if (!convexFavIds) return;
      this.idsFavoritos.set(new Set(convexFavIds));
    });
  }

  // ========= Convex: Suscripción a categorías =========
  private readonly categoriesQuery = this.convex.watchQuery(
    api.exercises.queries.listCategories,
    () => ({}),
  );

  readonly categoriasRes = {
    value: computed(() => {
      const raw = this.categoriesQuery.value();
      if (!raw) return [] as Categoria[];
      return raw.map(
        (c: { _id: string; nombreCategoria: string }) => ({
          id: mapId(c),
          nombre: c.nombreCategoria,
        }),
      );
    }),
    isLoading: this.categoriesQuery.isLoading,
    error: this.categoriesQuery.error,
    reload: () => {},
  };

  // ========= Convex: Suscripción a TODOS los ejercicios =========
  private readonly allExercisesQuery = this.convex.watchQuery(
    api.exercises.queries.listExercises,
    () => ({}),
  );

  private readonly allEjercicios = computed<Ejercicio[]>(() => {
    const raw = this.allExercisesQuery.value();
    if (!raw) return [];
    return raw.map((e: any) => this.mapConvexToEjercicio(e));
  });

  private readonly selectedCategoryNames = computed<string[]>(() => {
    const ids = this.idsCategoriasSeleccionadas();
    if (!ids.length) return [];
    const cats = this.categoriasRes.value();
    const idSet = new Set(ids);
    return cats
      .filter((c) => idSet.has(c.id))
      .map((c) => c.nombre);
  });

  // Búsqueda y filtros de categoría/favoritos van al factory; el sort se
  // aplica encima de `filtered()` (no es un filtro, es un orden) y la
  // paginación se hace manual sobre el resultado ordenado.
  private readonly _list = createFilteredList<Ejercicio>({
    source: this.allEjercicios,
    defaultPageSize: 24,
    searchPredicate: (e, q) => e.nombre.toLowerCase().includes(q),
    applyDomainFilters: (items) => {
      let list = items;

      const catNames = this.selectedCategoryNames();
      if (catNames.length > 0) {
        const nameSet = new Set(catNames);
        list = list.filter((e) =>
          e.categoria.some((cn: string) => nameSet.has(cn)),
        );
      }

      if (this.soloFavoritos()) {
        const favIds = this.idsFavoritos();
        list = favIds.size > 0 ? list.filter((e) => favIds.has(e.id)) : [];
      }

      return list;
    },
  });

  readonly busqueda = this._list.busqueda;
  readonly page = this._list.page;
  readonly pageSize = this._list.pageSize;
  readonly total = this._list.total;
  readonly totalPages = this._list.totalPages;

  private readonly sortedEjercicios = computed<Ejercicio[]>(() => {
    const list = [...this._list.filtered()];
    const dir = this.sort().startsWith('-') ? -1 : 1;
    return list.sort(
      (a, b) => dir * a.nombre.localeCompare(b.nombre),
    );
  });

  readonly ejercicios = computed(() => {
    const all = this.sortedEjercicios();
    const start = (this.page() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  readonly hasActiveFilters = computed(
    () =>
      !!this.busqueda().trim() ||
      this.idsCategoriasSeleccionadas().length > 0 ||
      this.soloFavoritos(),
  );

  readonly listaEjerciciosRes = {
    value: computed(() => ({
      data: this.ejercicios(),
      meta: { filter_count: this.total() },
    })),
    isLoading: this.allExercisesQuery.isLoading,
    error: this.allExercisesQuery.error,
    reload: () => {},
  };

  // ========= Cache y detalle =========
  findInCacheById(id: string): Ejercicio | undefined {
    return this.allEjercicios().find((e) => e.id === id);
  }

  getEjercicioById$(id: string): Observable<Ejercicio> {
    const cached = this.findInCacheById(id);
    if (cached) return of(cached);

    return from(
      this.convex.query(api.exercises.queries.getExerciseById, {
        exerciseId: id as any,
      }),
    ).pipe(map((raw: any) => this.mapConvexToEjercicio(raw)));
  }

  reloadEjercicios() {}
  reloadCategorias() {}

  // ========= Acciones (mutadores de filtro) =========
  setBusqueda(v: string) {
    this._list.setBusqueda(v);
  }

  toggleCategoria(id: string) {
    const set = new Set(this.idsCategoriasSeleccionadas());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.idsCategoriasSeleccionadas.set([...set]);
    this._list.resetPage();
  }

  limpiarCategorias() {
    this.idsCategoriasSeleccionadas.set([]);
    this._list.resetPage();
  }

  clearFilters() {
    this._list.busqueda.set('');
    this.idsCategoriasSeleccionadas.set([]);
    this.soloFavoritos.set(false);
    this._list.resetPage();
  }

  setSort(s: 'nombre' | '-nombre') {
    this.sort.set(s);
    this._list.resetPage();
  }

  setPageSize(n: number) {
    this._list.setPageSize(n);
  }

  goToPage(p: number) {
    this._list.goToPage(p);
  }

  // ========= Helper de assets (Cloudflare R2 vía assetUrl) =========
  getAssetUrl(id?: string) {
    return id ? `${rawAssetUrl(id)}` : '';
  }

  getVideoUrl(id?: string) {
    return id ? videoUrl(id) : '';
  }

  // ========= Favoritos (Convex) =========

  /**
   * No-op: los favoritos se cargan automáticamente via watchQuery.
   */
  cargarFavoritos(): void {}

  async toggleFavorito(idEjercicio: string): Promise<void> {
    this.favoritoEnProceso.set(idEjercicio);

    const esFavorito = this.idsFavoritos().has(idEjercicio);
    const nuevoSet = new Set(this.idsFavoritos());
    if (esFavorito) {
      nuevoSet.delete(idEjercicio);
    } else {
      nuevoSet.add(idEjercicio);
    }
    this.idsFavoritos.set(nuevoSet);

    try {
      await this.convex.mutation(api.exercises.mutations.toggleFavorite, {
        exerciseId: idEjercicio as any,
      });
    } catch (error) {
      console.error('Error toggling favorito:', error);
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

  esFavorito(idEjercicio: string): boolean {
    return this.idsFavoritos().has(idEjercicio);
  }

  toggleSoloFavoritos(): void {
    this.soloFavoritos.update((v) => !v);
    this._list.resetPage();
  }

  // ========= Mapper Convex → Ejercicio (dominio Angular) =========
  private mapConvexToEjercicio(raw: any): Ejercicio {
    return {
      id: mapId(raw),
      nombre: raw.nombreEjercicio ?? '',
      descripcion: raw.descripcion ?? '',
      seriesDefecto: raw.seriesDefecto,
      repeticionesDefecto: raw.repeticionesDefecto,
      video: raw.video ?? '',
      portada: raw.portada ?? '',
      categoria: raw.categorias ?? [],
    };
  }
}
