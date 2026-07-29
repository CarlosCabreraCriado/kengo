import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Ui2SpinnerComponent } from '../spinner/spinner.component';

/**
 * Cuerpo scrolleable de una página de editor (plan-builder, rutina-builder).
 *
 * Aporta el cap de 1280px, los paddings de página y el overlay de carga. El
 * contenido se proyecta tal cual; para la barra de acción inferior usar
 * `<ui2-editor-cta>` como **hermana** de este componente (queda fuera del cap
 * para poder ir full-bleed en desktop).
 *
 * Contrato del componente de ruta que lo usa:
 *
 * ```ts
 * host: { class: 'flex flex-col flex-1 min-h-0 w-full' }
 * ```
 *
 * Sin `overflow` en el host: el scroll vive en el `<main appScrollContainer>`
 * del shell. Es lo que hace posible el `position: sticky` de `<ui2-editor-cta>`
 * y lo que mantiene intacta la restauración de scroll del shell.
 *
 * Breakpoints (ver también `editor-layout.css`):
 * - **768px** — frontera de *chrome*: coincide con `esDesktop()` del shell
 *   (sidebar + topbar, sin tab-bar), así que a partir de aquí desaparece la
 *   reserva inferior para la tab-bar.
 * - **1024px** — frontera de *ancho disponible*: grid de dos columnas y filas
 *   siempre expandidas. Vive en `editor-layout.css`.
 */
@Component({
  selector: 'ui2-editor-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Ui2SpinnerComponent],
  template: `
    @if (loading()) {
      <div class="ui2-ep__loading">
        <ui2-spinner size="lg" color="primary" [label]="loadingLabel()"></ui2-spinner>
      </div>
    }
    <ng-content></ng-content>
  `,
  styles: [`
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 1280px;
      margin: 0 auto;
      gap: 16px;
      /* padding-bottom reserva: tab-bar (70px) + offset inferior + 8px de gap +
         alto del botón (~56px) + 36px de respiración entre último item y CTA. */
      padding: 12px 20px calc(170px + max(16px, var(--safe-bottom)));
    }

    /* A partir de 768px el shell ya no pinta la tab-bar (sidebar + topbar), así
       que no hay nada que reservar y el CTA pasa a sticky en el flujo. */
    @media (min-width: 768px) {
      :host {
        padding: 28px 32px 0;
        gap: 24px;
      }
    }

    .ui2-ep__loading {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(4px);
      z-index: var(--z-loader);
    }
  `],
})
export class Ui2EditorPageComponent {
  readonly loading = input(false);
  readonly loadingLabel = input('Cargando…');
}
