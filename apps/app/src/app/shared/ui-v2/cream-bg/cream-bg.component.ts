import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Cream wellness background V2 — fondo cream-50 + dos blur blobs (coral top-right, ámbar bottom-left).
 * Posición fixed/absolute full-screen detrás del contenido.
 */
@Component({
  selector: 'ui2-cream-bg',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-cream-bg" aria-hidden="true">
      <span class="ui2-cream-bg__blob ui2-cream-bg__blob--coral"></span>
      <span class="ui2-cream-bg__blob ui2-cream-bg__blob--amber"></span>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }
    .ui2-cream-bg {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: var(--cream-50);
    }
    .ui2-cream-bg__blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(64px);
      opacity: 0.55;
    }
    .ui2-cream-bg__blob--coral {
      width: 60vmin;
      height: 60vmin;
      top: -10vmin;
      right: -15vmin;
      background: radial-gradient(circle at 30% 30%, var(--kengo-primary-light), transparent 70%);
    }
    .ui2-cream-bg__blob--amber {
      width: 55vmin;
      height: 55vmin;
      bottom: -12vmin;
      left: -10vmin;
      background: radial-gradient(circle at 70% 70%, var(--kengo-tertiary), transparent 70%);
      opacity: 0.4;
    }
  `],
})
export class Ui2CreamBgComponent {}
