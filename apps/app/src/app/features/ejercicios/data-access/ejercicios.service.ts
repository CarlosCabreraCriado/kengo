import {
  Injectable,
  computed,
  effect,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { rawAssetUrl } from '../../../core/utils/asset-url';

import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';

import { Ejercicio } from '../../../../types/global';

export interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
}

export interface PaginaEjercicios {
  data: Ejercicio[];
  meta: { total_count?: number; filter_count?: number };
}

@Injectable({ providedIn: 'root' })
export class EjerciciosService {
  private convex = inject(ConvexService);

  // --- Filtros / paginación como señales puras ---
  readonly busqueda: WritableSignal<string> = signal('');
  readonly idsCategoriasSeleccionadas: WritableSignal<(string | number)[]> =
    signal([]);
  readonly page: WritableSignal<number> = signal(1);
  readonly pageSize: WritableSignal<number> = signal(24);
  readonly sort: WritableSignal<string> = signal('nombre_ejercicio');

  // --- Favoritos (Convex) ---
  readonly idsFavoritos: WritableSignal<Set<number>> = signal(new Set());
  readonly soloFavoritos: WritableSignal<boolean> = signal(false);
  readonly favoritoEnProceso: WritableSignal<number | null> = signal(null);

  // Suscripción a favoritos via Convex (devuelve Convex exercise IDs)
  private readonly favoritesQuery = this.convex.watchQuery(
    api.exercises.queries.listFavorites,
    () => ({}),
  );

  // Map: legacyId → Convex ID (para llamar mutations con Convex ID)
  readonly legacyToConvexId = computed(() => {
    const raw = this.allExercisesQuery.value();
    if (!raw) return new Map<number, string>();
    const m = new Map<number, string>();
    for (const e of raw) {
      if (e.legacyId != null) m.set(e.legacyId, e._id);
    }
    return m;
  });

  // Map inverso: Convex ID → legacyId (para convertir favoritos)
  private readonly convexToLegacyId = computed(() => {
    const raw = this.allExercisesQuery.value();
    if (!raw) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const e of raw) {
      if (e.legacyId != null) m.set(e._id, e.legacyId);
    }
    return m;
  });

  constructor() {
    // Sincronizar favoritos Convex → idsFavoritos (legacy IDs)
    effect(() => {
      const convexFavIds = this.favoritesQuery.value();
      if (!convexFavIds) return;
      const c2l = this.convexToLegacyId();
      const legacyIds = new Set<number>();
      for (const cid of convexFavIds) {
        const lid = c2l.get(cid);
        if (lid != null) legacyIds.add(lid);
      }
      this.idsFavoritos.set(legacyIds);
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
        (c: { legacyId?: number | null; nombreCategoria: string }) => ({
          id_categoria: c.legacyId ?? 0,
          nombre_categoria: c.nombreCategoria,
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

  // 1. Mapear Convex → Ejercicio (dominio Angular)
  private readonly allEjercicios = computed<Ejercicio[]>(() => {
    const raw = this.allExercisesQuery.value();
    if (!raw) return [];
    return raw.map((e: any) => this.mapConvexToEjercicio(e));
  });

  // 2. Resolver nombres de categorías seleccionadas (para filtro)
  private readonly selectedCategoryNames = computed<string[]>(() => {
    const ids = this.idsCategoriasSeleccionadas();
    if (!ids.length) return [];
    const cats = this.categoriasRes.value();
    const idSet = new Set(ids.map(Number));
    return cats
      .filter((c) => idSet.has(c.id_categoria))
      .map((c) => c.nombre_categoria);
  });

  // 3. Filtrar (búsqueda + categorías + favoritos)
  private readonly filteredEjercicios = computed<Ejercicio[]>(() => {
    let list = this.allEjercicios();

    // Filtro por búsqueda
    const search = this.busqueda().trim().toLowerCase();
    if (search) {
      list = list.filter((e) =>
        e.nombre_ejercicio.toLowerCase().includes(search),
      );
    }

    // Filtro por categorías seleccionadas
    const catNames = this.selectedCategoryNames();
    if (catNames.length > 0) {
      const nameSet = new Set(catNames);
      list = list.filter((e) =>
        e.categoria.some((cn: string) => nameSet.has(cn)),
      );
    }

    // Filtro de favoritos
    if (this.soloFavoritos()) {
      const favIds = this.idsFavoritos();
      if (favIds.size > 0) {
        list = list.filter((e) => favIds.has(e.id_ejercicio));
      } else {
        list = [];
      }
    }

    return list;
  });

  // 4. Ordenar
  private readonly sortedEjercicios = computed<Ejercicio[]>(() => {
    const list = [...this.filteredEjercicios()];
    const dir = this.sort().startsWith('-') ? -1 : 1;
    return list.sort(
      (a, b) => dir * a.nombre_ejercicio.localeCompare(b.nombre_ejercicio),
    );
  });

  // ========= Derivados (computed) para la vista =========
  readonly ejercicios = computed(() => {
    const all = this.sortedEjercicios();
    const start = (this.page() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  readonly total = computed(() => this.sortedEjercicios().length);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );

  readonly hasActiveFilters = computed(
    () =>
      !!this.busqueda().trim() ||
      this.idsCategoriasSeleccionadas().length > 0 ||
      this.soloFavoritos(),
  );

  // Interfaz compatible con httpResource para los templates
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
  findInCacheById(id: string | number): Ejercicio | undefined {
    const idNum = Number(id);
    return this.allEjercicios().find((e) => e.id_ejercicio === idNum);
  }

  getEjercicioById$(id: string | number): Observable<Ejercicio> {
    const cached = this.findInCacheById(id);
    if (cached) return of(cached);

    return from(
      this.convex.query(api.exercises.queries.getExerciseByLegacyId, {
        legacyId: Number(id),
      }),
    ).pipe(map((raw: any) => this.mapConvexToEjercicio(raw)));
  }

  // ========= Recargas (no-op con Convex, datos en tiempo real) =========
  reloadEjercicios() {}
  reloadCategorias() {}

  // ========= Acciones (mutadores de filtro) =========
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
    const max = this.totalPages();
    this.page.set(Math.min(Math.max(1, p), max));
  }

  // ========= Helper de assets (Directus CDN durante la transición) =========
  getAssetUrl(id?: string) {
    return id ? `${rawAssetUrl(id)}` : '';
  }

  // ========= Favoritos (Convex) =========

  /**
   * No-op: los favoritos se cargan automáticamente via watchQuery.
   * Se mantiene para compatibilidad con componentes que llaman cargarFavoritos().
   */
  cargarFavoritos(): void {}

  async toggleFavorito(idEjercicio: number): Promise<void> {
    const exerciseId = this.legacyToConvexId().get(idEjercicio);
    if (!exerciseId) return;

    this.favoritoEnProceso.set(idEjercicio);

    // Optimistic update
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
        exerciseId: exerciseId as any,
      });
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

  esFavorito(idEjercicio: number): boolean {
    return this.idsFavoritos().has(idEjercicio);
  }

  toggleSoloFavoritos(): void {
    this.soloFavoritos.update((v) => !v);
    this.page.set(1);
  }

  // ========= Mapper Convex → Ejercicio (dominio Angular) =========
  private mapConvexToEjercicio(raw: any): Ejercicio {
    return {
      id_ejercicio: raw.legacyId ?? 0,
      nombre_ejercicio: raw.nombreEjercicio ?? '',
      descripcion: raw.descripcion ?? '',
      series_defecto: raw.seriesDefecto ?? '',
      repeticiones_defecto: raw.repeticionesDefecto ?? '',
      video: raw.video ?? '',
      portada: raw.portada ?? '',
      categoria: raw.categorias ?? [],
    };
  }
}
