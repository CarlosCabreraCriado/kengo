import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NetworkService } from '../../services/network.service';

type BannerEstado = 'hidden' | 'offline' | 'reconnected';

/**
 * Pill compacta de estado de red. Aparece con debounce de 2s al perder
 * conexión (evita parpadeos en túneles/ascensores) y muestra un flash breve
 * de reconexión al volver. No bloquea la UI: Convex resincroniza solo.
 */
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (estado() !== 'hidden') {
      <div
        class="offline-banner"
        [class.offline-banner--ok]="estado() === 'reconnected'"
        role="status"
        aria-live="polite"
      >
        <span class="material-symbols-outlined offline-banner__icon" aria-hidden="true">
          {{ estado() === 'offline' ? 'cloud_off' : 'cloud_done' }}
        </span>
        {{ estado() === 'offline' ? 'Sin conexión' : 'Conectado de nuevo' }}
      </div>
    }
  `,
  styles: [`
    .offline-banner {
      position: fixed;
      top: calc(var(--safe-top) + 64px);
      left: 50%;
      transform: translateX(-50%);
      z-index: var(--z-banner);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 9999px;
      background: var(--ink-900);
      color: white;
      font-size: 12px;
      font-weight: 700;
      box-shadow: var(--shadow-card-strong);
      white-space: nowrap;
      animation: offline-banner-in 200ms ease-out;
    }
    .offline-banner--ok {
      background: var(--success);
    }
    .offline-banner__icon {
      font-size: 16px;
    }
    @keyframes offline-banner-in {
      from { opacity: 0; transform: translate(-50%, -6px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .offline-banner { animation: none; }
    }
  `],
})
export class OfflineBannerComponent {
  private readonly network = inject(NetworkService);

  private static readonly DEBOUNCE_OFFLINE_MS = 2000;
  private static readonly FLASH_RECONNECT_MS = 2500;

  readonly estado = signal<BannerEstado>('hidden');

  private offlineTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const online = this.network.online();
      if (!online) {
        this.clearTimers();
        this.offlineTimer = setTimeout(() => {
          this.estado.set('offline');
        }, OfflineBannerComponent.DEBOUNCE_OFFLINE_MS);
        return;
      }

      // untracked: el estado del banner no debe re-disparar este effect,
      // que solo reacciona a cambios de conectividad.
      const estabaOffline = untracked(this.estado) === 'offline';
      this.clearTimers();
      if (estabaOffline) {
        this.estado.set('reconnected');
        this.reconnectTimer = setTimeout(() => {
          this.estado.set('hidden');
        }, OfflineBannerComponent.FLASH_RECONNECT_MS);
      } else {
        this.estado.set('hidden');
      }
    });
  }

  private clearTimers(): void {
    if (this.offlineTimer) {
      clearTimeout(this.offlineTimer);
      this.offlineTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
