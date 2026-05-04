import { Injectable, inject } from '@angular/core';
import { Share } from '@capacitor/share';
import { PlatformService } from './platform.service';

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
}

/**
 * Wrapper de Web Share API. En native usa `@capacitor/share` (UX nativa); en
 * web usa `navigator.share` cuando esté disponible.
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly platform = inject(PlatformService);

  get isAvailable(): boolean {
    if (this.platform.isNative()) return true;
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }

  async share(options: ShareOptions): Promise<boolean> {
    if (this.platform.isNative()) {
      try {
        await Share.share(options);
        return true;
      } catch {
        return false;
      }
    }
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      return false;
    }
    try {
      await navigator.share(options);
      return true;
    } catch {
      return false;
    }
  }
}
