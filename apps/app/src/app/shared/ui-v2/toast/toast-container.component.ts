import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  ToastService,
  type Toast,
  type ToastType,
} from '../../services/toast/toast.service';

const ICONOS: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

/**
 * Renderiza la pila de toasts de `ToastService`. Es el único consumidor de
 * `toastService.toasts()`, así que sin él los `show()` de toda la app no
 * producen nada visible.
 *
 * Se monta una sola vez en `app.component.html`, fuera de los `@if` de shell,
 * para que también funcione en las pantallas de auth.
 *
 * Los toasts son avisos efímeros. Para un final de camino que el usuario deba
 * entender antes de seguir (un guardado rechazado, por ejemplo), usa
 * `DialogService`.
 */
@Component({
  selector: 'ui2-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-toasts" role="status" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="ui2-toast"
          [class]="'ui2-toast--' + toast.type"
          [attr.aria-live]="toast.type === 'error' ? 'assertive' : null"
        >
          <span class="material-symbols-outlined ui2-toast__icon" aria-hidden="true">
            {{ icono(toast.type) }}
          </span>

          <p class="ui2-toast__msg">{{ toast.message }}</p>

          @if (toast.action; as action) {
            <button
              type="button"
              class="ui2-toast__action"
              (click)="ejecutar(toast)"
            >
              {{ action.label }}
            </button>
          }

          <button
            type="button"
            class="ui2-toast__close"
            [attr.aria-label]="'Cerrar aviso: ' + toast.message"
            (click)="toastService.dismiss(toast.id)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ui2-toasts {
        position: fixed;
        /* Por encima de la tab bar flotante (70px de alto, anclada a
           max(16px, safe-area)). En desktop no hay tab bar y se baja. */
        bottom: calc(max(16px, env(safe-area-inset-bottom, 0px)) + 82px);
        left: 16px;
        right: 16px;
        z-index: var(--z-toast);
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 420px;
        margin: 0 auto;
        pointer-events: none;
      }

      @media (min-width: 768px) {
        .ui2-toasts {
          bottom: 24px;
        }
      }

      .ui2-toast {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 22px;
        background: #fff;
        border: 1px solid var(--ink-100);
        box-shadow: var(--shadow-card-strong);
        color: var(--ink-900);
        pointer-events: auto;
        animation: ui2-toast-in 180ms ease-out;
      }

      @keyframes ui2-toast-in {
        from {
          transform: translateY(12px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .ui2-toast {
          animation: none;
        }
      }

      .ui2-toast__icon {
        font-size: 20px;
        line-height: 22px;
        flex-shrink: 0;
      }
      .ui2-toast--success .ui2-toast__icon { color: var(--success); }
      .ui2-toast--error   .ui2-toast__icon { color: var(--danger); }
      .ui2-toast--warning .ui2-toast__icon { color: var(--warning); }
      .ui2-toast--info    .ui2-toast__icon { color: var(--info); }

      .ui2-toast__msg {
        flex: 1;
        min-width: 0;
        margin: 0;
        font-size: 14px;
        line-height: 1.4;
      }

      .ui2-toast__action {
        flex-shrink: 0;
        padding: 2px 4px;
        border-radius: 14px;
        font-size: 14px;
        font-weight: 600;
        color: var(--kengo-primary);
      }

      .ui2-toast__close {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 9999px;
        color: var(--ink-400);
      }
      .ui2-toast__close:hover { color: var(--ink-700); }
      .ui2-toast__close .material-symbols-outlined {
        font-size: 18px;
        line-height: 18px;
      }
    `,
  ],
})
export class Ui2ToastContainerComponent {
  readonly toastService = inject(ToastService);

  icono(type: ToastType): string {
    return ICONOS[type];
  }

  /** Ejecuta la acción del toast y lo cierra: ya ha cumplido su función. */
  ejecutar(toast: Toast): void {
    toast.action?.callback();
    this.toastService.dismiss(toast.id);
  }
}
