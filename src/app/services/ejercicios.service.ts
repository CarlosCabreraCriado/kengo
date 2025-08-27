import {
  Injectable,
  computed,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import { httpResource } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';

import { DirectusService } from './directus.service';

import { BehaviorSubject } from 'rxjs';

import { Observable } from 'rxjs';
import { of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

//Tipos:
import { Categoria, Ejercicio } from '../../types/global';

interface ExerciseQuery {
  name?: string;
  categoryIds?: (string | number)[];
  page: number;
  pageSize: number;
  sort?: string;
}

export interface PaginaEjercicios<T> {
  data: T[];
  meta: { total_count?: number; filter_count?: number };
}

export interface PeticionCategoria {
  data: Categoria[];
}

interface FiltroEjercicios {
  nombre_ejercicio?: { _icontains: string };
  categoria?: { categoria: { _in: (string | number)[] } };
}

@Injectable({ providedIn: 'root' })
export class EjerciciosService {
  public ejercicios$ = new BehaviorSubject<Ejercicio[] | null>(null);

  private directusService = inject(DirectusService);

  // --- Filtros / paginación como señales puras ---
  readonly busqueda: WritableSignal<string> = signal('');
  readonly idsCategoriasSeleccionadas: WritableSignal<(string | number)[]> =
    signal([]);
  readonly page: WritableSignal<number> = signal(1);
  readonly pageSize: WritableSignal<number> = signal(20);
  readonly sort: WritableSignal<string> = signal('nombre_ejercicio');

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
        url: `${this.directusService.directusUrl}/items/categorias`,
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

  getAssetUrl(id: unknown) {
    return `${this.directusService.directusUrl}/assets/${id}`;
  }

  private readonly peticionEjercicios = () => {
    const name = this.busqueda().trim();
    const cats = this.idsCategoriasSeleccionadas();
    const p = this.page();
    const ps = this.pageSize();
    const so = this.sort();

    const filter: FiltroEjercicios = {};
    if (name) filter['nombre_ejercicio'] = { _icontains: name };
    if (cats.length) {
      // Ajusta a tu esquema M2M si difiere:
      filter['categoria'] = { categoria: { _in: cats } };
      // Alternativas:
      // filter['categories'] = { id: { _in: cats } };
    }

    return {
      url: `${this.directusService.directusUrl}/items/ejercicios`,
      method: 'GET',
      params: {
        fields: 'id_ejercicio,nombre_ejercicio,descripcion',
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

  readonly listaEjerciciosRes = httpResource<{
    items: Ejercicio[];
    total: number;
  }>(this.peticionEjercicios, {
    parse: (res) => {
      const resultado = res as { items: Ejercicio[]; total: number };
      console.log('Ejercicios paginados: ', resultado);
      return resultado;
    },
    defaultValue: { items: [], total: 0 },
  });

  getEjercicios() {
    if (!this.ejercicios$.value) {
      this.directusService.getEjercicios().subscribe((response) => {
        if (response.data) {
          this.ejercicios$.next(response.data);
        }
      });
    }
  }

  getEjercicioById(id: number | null): Observable<Ejercicio | null> {
    if (id === null) return of(null);
    return this.ejercicios$.pipe(
      take(1), // solo necesitamos el valor actual
      switchMap((ejercicios) => {
        const ejercicioLocal = ejercicios?.find((e) => e.id_ejercicio === id);
        if (ejercicioLocal) {
          return of(ejercicioLocal);
        } else {
          // fallback: buscar en la API
          return this.directusService.getEjercicioById(id).pipe(
            // podrías agregar lógica para añadirlo a ejercicios$ si quieres
            map((ejercicio) => ejercicio || null),
          );
        }
      }),
    );
  }
}
