import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NetworkService } from '../../../core/services/network.service';

/**
 * Banner persistente que aparece pegado arriba del shell cuando no hay
 * conexión a internet. Vuelve a ocultarse al recuperar conectividad.
 *
 * Convenciones V2:
 * - Selector `ui2-*`, standalone, OnPush, signals.
 * - Respeta `env(safe-area-inset-top)` para no quedar bajo el notch en iOS.
 * - Z-index 70 → encima del header (60), debajo de los menús (1100).
 */
@Component({
  selector: 'ui2-offline-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!isOnline()) {
      <div class="ui2-offline-banner" role="status" aria-live="polite">
        <span class="material-symbols-outlined" aria-hidden="true">cloud_off</span>
        <span class="ui2-offline-banner__text">Sin conexión</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: var(--z-banner);
        display: block;
        pointer-events: none;
      }
      .ui2-offline-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 16px;
        padding-top: calc(8px + env(safe-area-inset-top, 0px));
        background: var(--ink-900);
        color: white;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.1px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
        animation: ui2-offline-slide-down 200ms ease-out;
        pointer-events: auto;
      }
      .ui2-offline-banner__text {
        line-height: 1;
      }
      .ui2-offline-banner .material-symbols-outlined {
        font-size: 18px;
      }
      @keyframes ui2-offline-slide-down {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `,
  ],
})
export class Ui2OfflineBannerComponent {
  private readonly network = inject(NetworkService);
  readonly isOnline = this.network.isOnline;
}
