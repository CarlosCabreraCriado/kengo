import { Injectable, inject } from '@angular/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { PlatformService } from './platform.service';

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

/**
 * Wrapper de feedback háptico/vibración. En native delega a `@capacitor/haptics`
 * (taptic engine en iOS, vibrator en Android). En web cae a `navigator.vibrate`.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly platform = inject(PlatformService);

  async impact(pattern: HapticPattern = 'medium'): Promise<void> {
    if (this.platform.isNative()) {
      try {
        switch (pattern) {
          case 'light':
            await Haptics.impact({ style: ImpactStyle.Light });
            return;
          case 'medium':
            await Haptics.impact({ style: ImpactStyle.Medium });
            return;
          case 'heavy':
            await Haptics.impact({ style: ImpactStyle.Heavy });
            return;
          case 'success':
            await Haptics.notification({ type: NotificationType.Success });
            return;
          case 'warning':
            await Haptics.notification({ type: NotificationType.Warning });
            return;
        }
      } catch {
        // ignorar si el plugin falla (p.ej. simulador iOS sin haptic)
      }
      return;
    }
    this.vibrateWeb(this.toVibrationPattern(pattern));
  }

  /** Patrón largo para fin de temporizador (ejercicio terminado). */
  async timerEnd(): Promise<void> {
    if (this.platform.isNative()) {
      try {
        await Haptics.notification({ type: NotificationType.Success });
      } catch {
        // ignore
      }
      return;
    }
    this.vibrateWeb([100, 50, 100]);
  }

  /** Patrón doble para fin de descanso (siguiente serie / ejercicio). */
  async restEnd(): Promise<void> {
    if (this.platform.isNative()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {
        // ignore
      }
      return;
    }
    this.vibrateWeb([100, 50, 100, 50, 100]);
  }

  private vibrateWeb(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  private toVibrationPattern(pattern: HapticPattern): number {
    switch (pattern) {
      case 'light': return 25;
      case 'medium': return 50;
      case 'heavy': return 100;
      case 'success': return 30;
      case 'warning': return 80;
    }
  }
}
