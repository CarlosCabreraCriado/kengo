import { signal, WritableSignal } from '@angular/core';
import {
  Ejercicio,
  EjercicioPlan,
} from '../../../../../types/global';

/**
 * Estado compartido por los servicios de builder (plan y rutina).
 *
 * Es una clase TS pura (no `@Injectable`): cada builder service crea su
 * propia instancia con `new BuilderItemsState()`. Esto evita que un
 * singleton compartido pise items entre modos.
 */
export class BuilderItemsState {
  readonly items = signal<EjercicioPlan[]>([]) as WritableSignal<
    EjercicioPlan[]
  >;
  readonly drawerOpen = signal(false);

  add(
    ejercicio: Ejercicio,
    options?: { series?: number; repeticiones?: number },
  ): boolean {
    const exists = this.items().some(
      (i) => i.ejercicio.id === ejercicio.id,
    );
    if (exists) return false;

    const series =
      options?.series ?? ejercicio.seriesDefecto ?? 3;
    const repeticiones =
      options?.repeticiones ?? ejercicio.repeticionesDefecto ?? 12;
    const orden = this.items().length + 1;

    this.items.update((list) => [
      ...list,
      {
        ejercicio,
        sort: orden,
        series,
        repeticiones,
        duracionSeg: undefined,
        descansoSeg: 45,
        vecesDia: 1,
        diasSemana: ['L', 'X', 'V'],
      },
    ]);
    this.drawerOpen.set(true);
    return true;
  }

  remove(ejercicioId: string): void {
    this.items.update((list) =>
      list
        .filter((i) => i.ejercicio.id !== ejercicioId)
        .map((i, idx) => ({ ...i, sort: idx + 1 })),
    );
  }

  reorder(fromIndex: number, toIndex: number): void {
    const arr = [...this.items()];
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    this.items.set(arr.map((i, idx) => ({ ...i, sort: idx + 1 })));
  }

  updateItem(idx: number, patch: Partial<EjercicioPlan>): void {
    const arr = [...this.items()];
    arr[idx] = { ...arr[idx], ...patch };
    this.items.set(arr);
  }

  setItems(items: EjercicioPlan[]): void {
    this.items.set(items);
  }

  clear(): void {
    this.items.set([]);
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  toggleDrawer(): void {
    this.drawerOpen.update((v) => !v);
  }
}
