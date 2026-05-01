import { Injectable, inject } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { PlatformService } from './platform.service';

/**
 * Wrapper para abrir URLs externas (Stripe Checkout, PDFs, enlaces externos).
 * En native usa `@capacitor/browser` (SFSafariViewController iOS / Custom Tab
 * Android), que mantiene al usuario dentro de la app. En web cae a
 * `window.location.href` / `window.open`.
 */
@Injectable({ providedIn: 'root' })
export class ExternalBrowserService {
  private readonly platform = inject(PlatformService);

  /** Abre la URL en una pestaña/ventana externa. */
  async open(url: string): Promise<void> {
    if (this.platform.isNative()) {
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    }
    window.open(url, '_blank');
  }

  /**
   * Redirige el flujo principal a la URL (uso típico: Stripe Checkout en web).
   * En native abre la URL en un browser modal y el regreso vendrá por deep
   * link (`kengo://billing/return`). El listener de `appUrlOpen` cierra el
   * Browser plugin y refresca estado.
   */
  async redirect(url: string): Promise<void> {
    if (this.platform.isNative()) {
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    }
    window.location.href = url;
  }

  /**
   * Cierra el browser modal (solo native). En web es no-op.
   * Llamar tras procesar el deep link de retorno (p.ej. tras pago Stripe).
   */
  async close(): Promise<void> {
    if (this.platform.isNative()) {
      try {
        await Browser.close();
      } catch {
        // si ya está cerrado, ignorar
      }
    }
  }
}
