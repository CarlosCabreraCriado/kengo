import { Injectable, computed, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

export type Platform = 'web' | 'ios' | 'android';

/**
 * Abstracción del runtime (web vs native). Lee `Capacitor.getPlatform()` al
 * arranque; en SSR / tests devuelve 'web'.
 *
 * Centralizar aquí evita imports dispersos a `@capacitor/core` y permite
 * mockear en tests.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly _platform = signal<Platform>(detectPlatform());

  readonly platform = this._platform.asReadonly();
  readonly isNative = computed(() => this._platform() !== 'web');
  readonly isIOS = computed(() => this._platform() === 'ios');
  readonly isAndroid = computed(() => this._platform() === 'android');
  readonly isWeb = computed(() => this._platform() === 'web');
}

function detectPlatform(): Platform {
  try {
    const p = Capacitor.getPlatform();
    if (p === 'ios' || p === 'android') return p;
    return 'web';
  } catch {
    return 'web';
  }
}

/**
 * Helper estático para usos puntuales fuera del DI (ej. `app.config.ts`).
 * Prefiere `PlatformService` en el resto del código.
 */
export function isCapacitorNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
