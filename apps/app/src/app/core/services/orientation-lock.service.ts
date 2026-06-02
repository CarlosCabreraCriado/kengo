import { Injectable, inject } from '@angular/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { PlatformService } from './platform.service';
import { LoggerService } from './logger.service';

/**
 * Bloqueo condicional de orientación en plataforma nativa.
 *
 * Si la dimensión más corta del dispositivo (CSS pixels) cae por debajo del
 * breakpoint `md:` de Tailwind (768 px), la app renderiza su layout móvil y
 * landscape se vería degradado → forzamos portrait. En tablets cuya dimensión
 * corta iguala o supera 768 px, la app ya renderiza el layout desktop incluso
 * en portrait, así que dejamos rotación libre.
 *
 * `window.screen.{width,height}` es estable (no cambia al rotar, a diferencia
 * de `innerWidth`), así que basta calcularlo una sola vez en el arranque.
 */
@Injectable({ providedIn: 'root' })
export class OrientationLockService {
  private platform = inject(PlatformService);
  private logger = inject(LoggerService);

  private static readonly MOBILE_BREAKPOINT_PX = 768;

  private aplicado = false;

  async aplicar(): Promise<void> {
    if (this.aplicado) return;
    if (!this.platform.isNative()) {
      this.logger.log('[OrientationLock] skip: no es plataforma nativa');
      return;
    }
    if (typeof window === 'undefined' || !window.screen) {
      this.logger.warn('[OrientationLock] skip: window.screen no disponible');
      return;
    }

    // El plugin se invoca a través del bridge nativo. En el constructor de
    // AppComponent puede que el bridge todavía esté terminando de registrar
    // los plugins, así que esperamos un microtask antes de llamar a lock().
    await new Promise<void>((r) => setTimeout(r, 0));

    const shortestSide = Math.min(window.screen.width, window.screen.height);
    this.logger.log(
      `[OrientationLock] screen=${window.screen.width}x${window.screen.height} ` +
        `shortest=${shortestSide} umbral=${OrientationLockService.MOBILE_BREAKPOINT_PX}`,
    );
    this.aplicado = true;

    try {
      if (shortestSide < OrientationLockService.MOBILE_BREAKPOINT_PX) {
        this.logger.log('[OrientationLock] → lock portrait');
        await ScreenOrientation.lock({ orientation: 'portrait' });
        this.logger.log('[OrientationLock] lock OK');
      } else {
        this.logger.log('[OrientationLock] → unlock (dispositivo tipo tablet)');
        await ScreenOrientation.unlock();
      }
    } catch (err) {
      this.logger.error('[OrientationLock] error al aplicar la política:', err);
    }
  }
}
