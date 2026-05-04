import { Injectable, inject } from '@angular/core';
import { Clipboard } from '@capacitor/clipboard';
import { PlatformService } from './platform.service';

/**
 * Wrapper de portapapeles. En native usa `@capacitor/clipboard`; en web usa
 * `navigator.clipboard.writeText`.
 */
@Injectable({ providedIn: 'root' })
export class ClipboardService {
  private readonly platform = inject(PlatformService);

  async write(text: string): Promise<boolean> {
    if (this.platform.isNative()) {
      try {
        await Clipboard.write({ string: text });
        return true;
      } catch {
        return false;
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
