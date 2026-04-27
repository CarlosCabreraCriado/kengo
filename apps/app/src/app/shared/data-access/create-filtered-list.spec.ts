import { signal } from '@angular/core';
import { createFilteredList } from './create-filtered-list';

interface Item {
  id: string;
  nombre: string;
  categoria: string;
}

function makeItems(n: number, categoria = 'a'): Item[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${i}`,
    nombre: `Item ${i}`,
    categoria,
  }));
}

describe('createFilteredList', () => {
  it('expone los items completos cuando no hay filtros', () => {
    const source = signal<Item[]>(makeItems(5));
    const list = createFilteredList<Item>({ source });

    expect(list.total()).toBe(5);
    expect(list.items().length).toBe(5);
    expect(list.totalPages()).toBe(1);
  });

  it('aplica el searchPredicate cuando hay query', () => {
    const source = signal<Item[]>([
      { id: '1', nombre: 'Sentadilla', categoria: 'pierna' },
      { id: '2', nombre: 'Press banca', categoria: 'pecho' },
      { id: '3', nombre: 'Sentadilla búlgara', categoria: 'pierna' },
    ]);
    const list = createFilteredList<Item>({
      source,
      searchPredicate: (item, q) => item.nombre.toLowerCase().includes(q),
    });

    list.setBusqueda('sentadilla');

    expect(list.total()).toBe(2);
    expect(list.items().map((i) => i.id)).toEqual(['1', '3']);
  });

  it('no filtra si searchPredicate está ausente (caso server-side)', () => {
    const source = signal<Item[]>(makeItems(3));
    const list = createFilteredList<Item>({ source });

    list.setBusqueda('cualquier-cosa');

    expect(list.total()).toBe(3);
  });

  it('aplica applyDomainFilters tras la búsqueda', () => {
    const source = signal<Item[]>([
      { id: '1', nombre: 'A', categoria: 'x' },
      { id: '2', nombre: 'A', categoria: 'y' },
      { id: '3', nombre: 'B', categoria: 'x' },
    ]);
    const list = createFilteredList<Item>({
      source,
      searchPredicate: (item, q) => item.nombre.toLowerCase() === q,
      applyDomainFilters: (items) => items.filter((i) => i.categoria === 'x'),
    });

    list.setBusqueda('a');

    expect(list.total()).toBe(1);
    expect(list.items()[0].id).toBe('1');
  });

  it('setBusqueda resetea page a 1', () => {
    const source = signal<Item[]>(makeItems(50));
    const list = createFilteredList<Item>({
      source,
      defaultPageSize: 10,
    });

    list.goToPage(3);
    expect(list.page()).toBe(3);

    list.setBusqueda('q');
    expect(list.page()).toBe(1);
  });

  it('goToPage clampa a [1, totalPages]', () => {
    const source = signal<Item[]>(makeItems(25));
    const list = createFilteredList<Item>({ source, defaultPageSize: 10 });

    list.goToPage(0);
    expect(list.page()).toBe(1);

    list.goToPage(99);
    expect(list.page()).toBe(3);

    list.goToPage(-5);
    expect(list.page()).toBe(1);
  });

  it('items pagina correctamente según page y pageSize', () => {
    const source = signal<Item[]>(makeItems(25));
    const list = createFilteredList<Item>({ source, defaultPageSize: 10 });

    expect(list.items().length).toBe(10);
    expect(list.items()[0].id).toBe('0');

    list.goToPage(2);
    expect(list.items().length).toBe(10);
    expect(list.items()[0].id).toBe('10');

    list.goToPage(3);
    expect(list.items().length).toBe(5);
    expect(list.items()[0].id).toBe('20');
  });

  it('setPageSize resetea page y recalcula totalPages', () => {
    const source = signal<Item[]>(makeItems(25));
    const list = createFilteredList<Item>({ source, defaultPageSize: 10 });

    list.goToPage(3);
    list.setPageSize(5);

    expect(list.page()).toBe(1);
    expect(list.totalPages()).toBe(5);
  });

  it('reacciona a cambios en source', () => {
    const source = signal<Item[]>(makeItems(3));
    const list = createFilteredList<Item>({ source });

    expect(list.total()).toBe(3);

    source.set(makeItems(10));
    expect(list.total()).toBe(10);
  });

  it('totalPages es al menos 1 incluso con 0 items', () => {
    const source = signal<Item[]>([]);
    const list = createFilteredList<Item>({ source });

    expect(list.total()).toBe(0);
    expect(list.totalPages()).toBe(1);
  });
});
