import { inject, Injectable, NgZone, signal } from '@angular/core';
import { Network } from '@capacitor/network';
import { LoggerService } from './logger.service';
import { PlatformService } from './platform.service';

/**
 * Estado de conectividad como signal, alimentado por @capacitor/network en
 * nativo (eventos del sistema, fiables en cambios wifi↔celular↔avión) y por
 * navigator.onLine + eventos online/offline en web.
 *
 * Consumidores: OfflineBannerComponent (aviso visual), SessionPreloadStrategy
 * (no precargar sin red) y ConnectionErrorComponent (gate del reintento).
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly platform = inject(PlatformService);
  private readonly ngZone = inject(NgZone);
  private readonly logger = inject(LoggerService);

  private readonly _online = signal<boolean>(true);
  private readonly _connectionType = signal<string>('unknown');

  /** true cuando hay conectividad (optimista hasta la primera lectura). */
  readonly online = this._online.asReadonly();
  /** 'wifi' | 'cellular' | 'none' | 'unknown' (solo fiable en nativo). */
  readonly connectionType = this._connectionType.asReadonly();

  constructor() {
    if (this.platform.isNative()) {
      this.initNative();
    } else {
      this.initWeb();
    }
  }

  private initNative(): void {
    void Network.getStatus()
      .then((status) => {
        this._online.set(status.connected);
        this._connectionType.set(status.connectionType);
      })
      .catch((err) => this.logger.warn('[Network] getStatus falló:', err));

    void Network.addListener('networkStatusChange', (status) => {
      this.ngZone.run(() => {
        this._online.set(status.connected);
        this._connectionType.set(status.connectionType);
      });
    });
  }

  private initWeb(): void {
    this._online.set(navigator.onLine);
    window.addEventListener('online', () => this._online.set(true));
    window.addEventListener('offline', () => this._online.set(false));
  }
}
