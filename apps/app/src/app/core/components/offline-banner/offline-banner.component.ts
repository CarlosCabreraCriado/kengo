import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ConvexService } from '../../convex/convex.service';
import { AssetHostService } from '../../services/asset-host.service';
import { NetworkService } from '../../services/network.service';

type BannerEstado = 'hidden' | 'offline' | 'reconnected' | 'restricted' | 'reconnecting';

const TEXTO: Record<Exclude<BannerEstado, 'hidden'>, string> = {
  offline: 'Sin conexión',
  reconnected: 'Conectado de nuevo',
  restricted: 'Conexión limitada por tu operador',
  reconnecting: 'Reconectando…',
};

const ICONO: Record<Exclude<BannerEstado, 'hidden'>, string> = {
  offline: 'cloud_off',
  reconnected: 'cloud_done',
  restricted: 'sports_soccer',
  reconnecting: 'sync',
};

/**
 * Pill compacta de estado de red. Aparece con debounce de 2s al perder
 * conexión (evita parpadeos en túneles/ascensores) y muestra un flash breve
 * de reconexión al volver. No bloquea la UI: Convex resincroniza solo.
 *
 * Con red disponible distingue además dos degradaciones:
 * - `restricted`: el host de assets en Cloudflare no responde y se sirve
 *   desde el proxy de Railway — la firma de los bloqueos de LaLiga a las IPs
 *   de Cloudflare durante los partidos. El mensaje deja claro que no es un
 *   fallo de la app y evita tickets de soporte.
 * - `reconnecting`: el WebSocket de Convex lleva > `DEBOUNCE_WS_MS` caído
 *   tras haber conectado alguna vez.
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
        [class.offline-banner--warn]="estado() === 'restricted'"
        role="status"
        aria-live="polite"
      >
        <span class="material-symbols-outlined offline-banner__icon" aria-hidden="true">
          {{ icono() }}
        </span>
        {{ texto() }}
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
    .offline-banner--warn {
      background: var(--warning, #b45309);
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
  private readonly convex = inject(ConvexService);
  private readonly assetHost = inject(AssetHostService);

  private static readonly DEBOUNCE_OFFLINE_MS = 2000;
  private static readonly FLASH_RECONNECT_MS = 2500;
  private static readonly DEBOUNCE_WS_MS = 8000;

  readonly estado = signal<BannerEstado>('hidden');

  readonly texto = (): string => {
    const e = this.estado();
    return e === 'hidden' ? '' : TEXTO[e];
  };
  readonly icono = (): string => {
    const e = this.estado();
    return e === 'hidden' ? '' : ICONO[e];
  };

  private offlineTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wsTimer: ReturnType<typeof setTimeout> | null = null;

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
          this.estado.set(untracked(() => this.estadoDegradado()));
        }, OfflineBannerComponent.FLASH_RECONNECT_MS);
      } else {
        this.estado.set(untracked(() => this.estadoDegradado()));
      }
    });

    // Degradaciones con red: solo se evalúan cuando el banner no está en un
    // estado transitorio (offline / flash de reconexión), que tienen prioridad.
    effect(() => {
      const restricted = this.assetHost.fallbackActivo();
      const wsDown = this.convex.hasEverConnected() && !this.convex.isConnected();
      const actual = untracked(this.estado);
      if (actual === 'offline' || actual === 'reconnected') return;

      if (restricted) {
        this.clearWsTimer();
        this.estado.set('restricted');
        return;
      }
      if (wsDown) {
        if (actual === 'reconnecting' || this.wsTimer) return;
        this.wsTimer = setTimeout(() => {
          this.wsTimer = null;
          if (this.network.online()) this.estado.set('reconnecting');
        }, OfflineBannerComponent.DEBOUNCE_WS_MS);
        return;
      }
      this.clearWsTimer();
      this.estado.set('hidden');
    });
  }

  /** Estado a mostrar con red disponible (sin debounce del WS). */
  private estadoDegradado(): BannerEstado {
    if (this.assetHost.fallbackActivo()) return 'restricted';
    return 'hidden';
  }

  private clearWsTimer(): void {
    if (this.wsTimer) {
      clearTimeout(this.wsTimer);
      this.wsTimer = null;
    }
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
    this.clearWsTimer();
  }
}
