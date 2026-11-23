import { Injectable, signal } from '@angular/core';

/**
 * Estado del popup «Te llamamos» del botón flotante. Cualquier CTA de la home
 * puede abrirlo (p. ej. el gancho de la sección de monetización) sin conocer
 * el componente que pinta el `<dialog>`.
 */
@Injectable({ providedIn: 'root' })
export class ContactoDialogService {
  private readonly _abierto = signal(false);
  readonly abierto = this._abierto.asReadonly();

  abrir(): void {
    this._abierto.set(true);
  }

  cerrar(): void {
    this._abierto.set(false);
  }
}
