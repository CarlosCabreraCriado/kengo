import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Network } from '@capacitor/network';

import { PlatformService } from './platform.service';

/**
 * Estado de conectividad reactivo. En native escucha
 * `Network.addListener('networkStatusChange', ...)`; en web usa los eventos
 * `online` / `offline` del `window`. Expone una signal `isOnline` consumible
 * por componentes (p. ej. `Ui2OfflineBannerComponent`).
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly platform = inject(PlatformService);
  private readonly ngZone = inject(NgZone);

  private readonly _isOnline = signal<boolean>(true);
  readonly isOnline = this._isOnline.asReadonly();

  constructor() {
    if (this.platform.isNative()) {
      this.inicializarNative();
    } else {
      this.inicializarWeb();
    }
  }

  private async inicializarNative(): Promise<void> {
    try {
      const status = await Network.getStatus();
      this.ngZone.run(() => this._isOnline.set(status.connected));
    } catch {
      // Si el plugin no está disponible (simulator antiguo) asumimos online.
    }
    Network.addListener('networkStatusChange', (status) => {
      this.ngZone.run(() => this._isOnline.set(status.connected));
    });
  }

  private inicializarWeb(): void {
    if (typeof window === 'undefined') return;
    this._isOnline.set(window.navigator.onLine);
    window.addEventListener('online', () => this._isOnline.set(true));
    window.addEventListener('offline', () => this._isOnline.set(false));
  }
}
