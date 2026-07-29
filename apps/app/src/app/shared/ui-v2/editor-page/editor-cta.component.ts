import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Barra de acción inferior de las páginas de editor.
 *
 * Se usa como **hermana** de `<ui2-editor-page>` (no dentro), para quedar fuera
 * del cap de 1280px: así en desktop la barra ocupa todo el ancho del `<main>`
 * y el `__inner` realinea el botón con las tarjetas del contenido.
 *
 * - **Móvil (<768px)**: `fixed` justo encima de `<ui2-patient-tab-bar>`. Los
 *   `70px` de alto, el offset de `16px` y el `max-width: 720px` replican la
 *   geometría de la tab-bar (`patient-tab-bar.component.ts`) para que las dos
 *   píldoras flotantes queden alineadas.
 * - **≥768px**: `sticky` full-bleed con fondo translúcido; a esa anchura el
 *   shell ya no pinta la tab-bar.
 *
 * Con el teclado virtual abierto se desvanece igual que la tab-bar
 * (`body.kb-visible`, ver `styles.css`): el CTA está anclado al viewport, que se
 * encoge con `Keyboard.resize` nativo, y sin esto "subiría" hasta media pantalla
 * tapando el campo en edición.
 */
@Component({
  selector: 'ui2-editor-cta',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-ec__inner">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      bottom: calc(70px + max(16px, var(--safe-bottom)) + 8px);
      left: 16px;
      right: 16px;
      max-width: 720px;
      margin: 0 auto;
      z-index: var(--z-sticky);
      animation: ui2-ec-enter 220ms cubic-bezier(0.2, 0.8, 0.3, 1);
      transition:
        opacity var(--kb-transition-duration) var(--kb-transition-easing),
        transform var(--kb-transition-duration) var(--kb-transition-easing);
    }

    .ui2-ec__inner {
      width: 100%;
    }

    :host-context(body.kb-visible) {
      opacity: 0;
      transform: translateY(12px);
      pointer-events: none;
    }

    @media (min-width: 768px) {
      :host {
        position: sticky;
        bottom: 0;
        left: 0;
        right: 0;
        max-width: none;
        margin: 0;
        padding: 16px 0 calc(24px + var(--safe-bottom));
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.06);
        border-top: 1px solid rgba(0, 0, 0, 0.04);
      }
      .ui2-ec__inner {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 32px;
      }
    }

    @keyframes ui2-ec-enter {
      from {
        opacity: 0;
        transform: translateY(24px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `],
})
export class Ui2EditorCtaComponent {}
