import { Injectable, signal } from '@angular/core';

/**
 * Estado de layout del carrito de ejercicios compartido con el shell
 * (`AppComponent`).
 *
 * El carrito es un overlay `position: fixed` anclado al borde derecho. Su
 * pestaña lateral (`.ui2-cart__tab`) no reserva espacio en el flujo, así que el
 * shell lee `tabVisible` para reservar un carril derecho (`padding-right`) en el
 * `<main>` de desktop y evitar que la pestaña tape botones/controles del
 * contenido.
 */
@Injectable({ providedIn: 'root' })
export class CarritoLayoutService {
  private readonly _tabVisible = signal(false);

  /** `true` cuando la pestaña lateral del carrito ocupa el borde derecho. */
  readonly tabVisible = this._tabVisible.asReadonly();

  setTabVisible(visible: boolean): void {
    this._tabVisible.set(visible);
  }
}
