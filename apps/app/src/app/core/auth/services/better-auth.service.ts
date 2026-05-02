import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { createAuthClient } from 'better-auth/client';
import { magicLinkClient } from 'better-auth/client/plugins';
import {
  crossDomainClient,
  convexClient,
} from '@convex-dev/better-auth/client/plugins';
import { environment } from '../../../../environments/environment';
import { PlatformService } from '../../services/platform.service';

// Claves internas del plugin `crossDomainClient` (ver
// node_modules/@convex-dev/better-auth/src/plugins/cross-domain/client.ts).
// El plugin usa localStorage por defecto con estos nombres; nosotros los
// duplicamos en `@capacitor/preferences` en native para que la sesión sobreviva
// a la purga periódica que iOS WebView hace de localStorage.
const LS_COOKIE_KEY = 'better-auth_cookie';
const LS_SESSION_KEY = 'better-auth_session_data';
const PREFS_COOKIE_KEY = 'ba_cookie';
const PREFS_SESSION_KEY = 'ba_session_data';

@Injectable({ providedIn: 'root' })
export class BetterAuthService {
  private readonly platform = inject(PlatformService);

  private authClient = createAuthClient({
    baseURL: environment.CONVEX_SITE_URL,
    plugins: [crossDomainClient(), convexClient(), magicLinkClient()],
  });

  /**
   * Inicia sesion en Better-Auth. Si las credenciales no son válidas, devuelve
   * `{ ok: false, code }` para que el caller pueda diferenciar password
   * incorrecto, usuario inexistente o error de red.
   *
   * IMPORTANTE: el registro es un flujo separado (`AuthService.register` →
   * `convex/auth/actions.ts:register`). No crear usuarios desde aquí.
   */
  async signIn(
    email: string,
    password: string,
  ): Promise<{ ok: boolean; code?: string }> {
    try {
      const result = await this.authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        return { ok: false, code: result.error.code };
      }

      await this.backupToNative();
      return { ok: true };
    } catch (err) {
      console.warn('Better-Auth signIn failed:', err);
      return { ok: false, code: 'NETWORK_ERROR' };
    }
  }

  /**
   * Cierra sesion en Better-Auth.
   */
  async signOut(): Promise<void> {
    try {
      await this.authClient.signOut();
    } catch {
      // Ignorar errores de signOut
    }
    await this.clearNativeBackup();
  }

  /**
   * Obtiene un token JWT de Convex llamando al endpoint /api/auth/convex/token.
   * El crossDomainClient envía la sesión via header Better-Auth-Cookie.
   */
  async getConvexToken(): Promise<string | null> {
    try {
      const cookie = (this.authClient as any).getCookie?.();
      if (!cookie) return null;

      const res = await fetch(
        `${environment.CONVEX_SITE_URL}/api/auth/convex/token`,
        {
          method: 'GET',
          headers: {
            'Better-Auth-Cookie': cookie,
          },
        },
      );

      if (!res.ok) return null;

      const data = await res.json();
      return data?.token ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Verifica un magic link token (consumo de access token QR).
   * Usa el fetch interno del authClient para que el plugin crossDomain
   * capture el header Set-Better-Auth-Cookie y persista la sesión.
   */
  async verifyMagicLink(token: string): Promise<boolean> {
    try {
      const res = await (this.authClient as any).$fetch(
        '/magic-link/verify',
        { query: { token } },
      );
      if (res?.error) {
        console.warn('Better-Auth magicLink verify error:', res.error);
        return false;
      }
      await this.backupToNative();
      return true;
    } catch (err) {
      console.warn('Better-Auth magicLink verify failed:', err);
      return false;
    }
  }

  /**
   * Verifica si hay una sesion Better-Auth almacenada (crossDomain usa localStorage).
   */
  hasStoredSession(): boolean {
    try {
      const cookie = (this.authClient as any).getCookie?.();
      return !!cookie;
    } catch {
      return false;
    }
  }

  /**
   * En native: si localStorage está vacío (purga del sistema o primer arranque
   * tras reinstalar), restaura la sesión desde `@capacitor/preferences`.
   * Llamar al inicio de `AuthService.iniciarApp()`, antes de tocar el authClient.
   * No-op en web.
   */
  async restoreFromNative(): Promise<void> {
    if (!this.platform.isNative() || typeof localStorage === 'undefined') return;
    try {
      if (!localStorage.getItem(LS_COOKIE_KEY)) {
        const { value } = await Preferences.get({ key: PREFS_COOKIE_KEY });
        if (value) localStorage.setItem(LS_COOKIE_KEY, value);
      }
      if (!localStorage.getItem(LS_SESSION_KEY)) {
        const { value } = await Preferences.get({ key: PREFS_SESSION_KEY });
        if (value) localStorage.setItem(LS_SESSION_KEY, value);
      }
    } catch (err) {
      console.warn('[BetterAuth] restoreFromNative failed:', err);
    }
  }

  /**
   * Copia el estado actual de localStorage al storage nativo persistente.
   * No-op en web.
   */
  private async backupToNative(): Promise<void> {
    if (!this.platform.isNative() || typeof localStorage === 'undefined') return;
    try {
      const cookie = localStorage.getItem(LS_COOKIE_KEY);
      if (cookie) await Preferences.set({ key: PREFS_COOKIE_KEY, value: cookie });
      const session = localStorage.getItem(LS_SESSION_KEY);
      if (session) await Preferences.set({ key: PREFS_SESSION_KEY, value: session });
    } catch (err) {
      console.warn('[BetterAuth] backupToNative failed:', err);
    }
  }

  private async clearNativeBackup(): Promise<void> {
    if (!this.platform.isNative()) return;
    try {
      await Preferences.remove({ key: PREFS_COOKIE_KEY });
      await Preferences.remove({ key: PREFS_SESSION_KEY });
    } catch {
      // ignore
    }
  }
}
