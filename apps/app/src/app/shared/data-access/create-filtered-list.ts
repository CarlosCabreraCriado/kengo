import { Signal, WritableSignal, computed, signal } from '@angular/core';

export interface FilteredListConfig<T> {
  /** Fuente reactiva de items (típicamente un computed sobre un watchQuery). */
  source: Signal<T[]>;

  /**
   * Predicado de búsqueda client-side. Recibe el item y la query trimeada
   * + lowercase. Si se omite, no se filtra por búsqueda (caso server-side:
   * el servicio lee `busqueda()` para reactivar su query).
   */
  searchPredicate?: (item: T, query: string) => boolean;

  /** Filtros de dominio aplicados tras la búsqueda. */
  applyDomainFilters?: (items: T[]) => T[];

  /** Tamaño de página por defecto (default `20`). */
  defaultPageSize?: number;
}

export interface FilteredList<T> {
  readonly busqueda: WritableSignal<string>;
  readonly page: WritableSignal<number>;
  readonly pageSize: WritableSignal<number>;

  readonly filtered: Signal<T[]>;
  readonly items: Signal<T[]>;
  readonly total: Signal<number>;
  readonly totalPages: Signal<number>;

  setBusqueda(value: string): void;
  goToPage(page: number): void;
  setPageSize(size: number): void;
  resetPage(): void;
}

/**
 * Factory que encapsula el patrón de listado paginado con búsqueda y
 * filtros de dominio. Cada servicio la instancia y re-expone los miembros
 * que necesite mantener compatibles con sus consumidores.
 */
export function createFilteredList<T>(
  config: FilteredListConfig<T>,
): FilteredList<T> {
  const busqueda = signal('');
  const page = signal(1);
  const pageSize = signal(config.defaultPageSize ?? 20);

  const filtered = computed<T[]>(() => {
    let list = config.source();

    const query = busqueda().trim().toLowerCase();
    if (query && config.searchPredicate) {
      const predicate = config.searchPredicate;
      list = list.filter((item) => predicate(item, query));
    }

    if (config.applyDomainFilters) {
      list = config.applyDomainFilters(list);
    }

    return list;
  });

  const total = computed(() => filtered().length);
  const totalPages = computed(() =>
    Math.max(1, Math.ceil(total() / pageSize())),
  );

  const items = computed(() => {
    const all = filtered();
    const start = (page() - 1) * pageSize();
    return all.slice(start, start + pageSize());
  });

  function setBusqueda(value: string): void {
    busqueda.set(value);
    page.set(1);
  }

  function goToPage(p: number): void {
    page.set(Math.min(Math.max(1, p), totalPages()));
  }

  function setPageSize(size: number): void {
    pageSize.set(size);
    page.set(1);
  }

  function resetPage(): void {
    page.set(1);
  }

  return {
    busqueda,
    page,
    pageSize,
    filtered,
    items,
    total,
    totalPages,
    setBusqueda,
    goToPage,
    setPageSize,
    resetPage,
  };
}
