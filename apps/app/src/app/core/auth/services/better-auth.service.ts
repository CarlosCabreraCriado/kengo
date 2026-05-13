import { Injectable, inject, signal } from '@angular/core';
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

// Si el endpoint /api/auth/convex/token tarda más de esto, se aborta y se
// reporta como timeout para que el cliente muestre la pantalla de error en vez
// de quedarse esperando 2 minutos al timeout del navegador.
const CONVEX_TOKEN_TIMEOUT_MS = 8000;

// Latencia a partir de la cual una llamada a `getConvexToken` se considera
// sospechosa. No es un fallo (la llamada puede acabar bien), pero queremos
// dejar rastro en logs para que el siguiente 504 sea detectable antes.
const CONVEX_TOKEN_SLOW_THRESHOLD_MS = 3000;

/**
 * Métrica de una llamada a `getConvexToken`. Se emite por log estructurado
 * (prefijo `[ConvexToken]`) y se expone como signal para que cualquier
 * sistema de telemetría futuro (Sentry/PostHog/log custom) pueda engancharse
 * sin modificar el servicio. Útil también para debugging desde DevTools:
 *
 *     window.__kengoTokenMetrics // → lista de los últimos N intentos
 */
export interface ConvexTokenAttempt {
  /** ISO timestamp del inicio del fetch. */
  startedAt: string;
  /** Tiempo total entre fetch start y resolución (incluye parseo). */
  latencyMs: number;
  /** Status HTTP recibido. `null` si la request no llegó al servidor. */
  httpStatus: number | null;
  /** Reason del `ConvexTokenResult` (incluido `'ok'` cuando hubo éxito). */
  reason:
    | 'ok'
    | 'no-session'
    | 'timeout'
    | 'network'
    | 'unauthorized'
    | 'server-error';
}

// Solo guardamos en memoria los últimos N intentos para evitar leak. Si en el
// futuro se conecta telemetría externa, se exporta el array completo en cada
// emisión y se reinicia.
const TOKEN_METRICS_BUFFER_SIZE = 20;

/**
 * Resultado del intento de obtener un token Convex.
 * - `ok: true`  → token válido.
 * - `ok: false` → distinguimos sesión inválida real (`unauthorized`) de
 *   problemas de red recuperables (`timeout`/`network`/`server-error`), porque
 *   solo los primeros deben echar al usuario al login.
 */
export type ConvexTokenResult =
  | { ok: true; token: string }
  | {
      ok: false;
      reason:
        | 'no-session'
        | 'timeout'
        | 'network'
        | 'unauthorized'
        | 'server-error';
    };

@Injectable({ providedIn: 'root' })
export class BetterAuthService {
  private readonly platform = inject(PlatformService);

  private authClient = createAuthClient({
    baseURL: environment.CONVEX_SITE_URL,
    plugins: [crossDomainClient(), convexClient(), magicLinkClient()],
  });

  // Buffer reactivo de las últimas llamadas a `getConvexToken`. Expuesto como
  // signal para que la UI o devtools puedan inspeccionarlo. La telemetría
  // externa (cuando se integre) puede leer este signal vía `effect` o leer
  // `__kengoTokenMetrics` desde dev tools.
  private readonly _tokenAttempts = signal<ConvexTokenAttempt[]>([]);
  readonly tokenAttempts = this._tokenAttempts.asReadonly();

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
   *
   * Tras esto se garantiza que tanto `localStorage` (cookie cross-domain +
   * session_data) como el backup nativo en `@capacitor/preferences` quedan
   * limpios, incluso si el `signOut` del cliente falla por red. Esto evita
   * estado zombie donde `hasStoredSession()` devuelve true pero el servidor
   * ya no reconoce la sesión.
   */
  async signOut(): Promise<void> {
    try {
      await this.authClient.signOut();
    } catch {
      // Ignorar errores de signOut
    }
    await this.purgeStoredSession();
  }

  /**
   * Borra toda la información local de la sesión Better-Auth (cookie cross-
   * domain y session_data, en localStorage y en el backup nativo). Idempotente
   * y silencioso. Llamar siempre que detectemos sesión inválida — el plugin
   * solo limpia localStorage si la request de `/sign-out` llega a su `init`;
   * en logout offline o en invalidación server-side ese path no se ejecuta.
   */
  async purgeStoredSession(): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LS_COOKIE_KEY);
        localStorage.removeItem(LS_SESSION_KEY);
      }
    } catch {
      /* ignore */
    }
    await this.clearNativeBackup();
  }

  /**
   * Obtiene un token JWT de Convex llamando al endpoint /api/auth/convex/token.
   * El crossDomainClient envía la sesión via header Better-Auth-Cookie.
   *
   * Devuelve un resultado discriminado (ver `ConvexTokenResult`): los callers
   * deben tratar `unauthorized` como sesión inválida (→ login) y
   * `timeout`/`network`/`server-error` como problemas temporales (→ pantalla
   * de reintento). El fetch tiene timeout duro de 8 s.
   *
   * Cada intento se registra como `ConvexTokenAttempt` (latencia, status,
   * reason) — ver `recordTokenAttempt` para los detalles del logging y la
   * exposición vía signal.
   */
  async getConvexToken(): Promise<ConvexTokenResult> {
    const startedAt = new Date().toISOString();
    const t0 = performance.now();

    const cookie = (this.authClient as any).getCookie?.();
    if (!cookie) {
      this.recordTokenAttempt({
        startedAt,
        latencyMs: Math.round(performance.now() - t0),
        httpStatus: null,
        reason: 'no-session',
      });
      return { ok: false, reason: 'no-session' };
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      CONVEX_TOKEN_TIMEOUT_MS,
    );

    let res: Response;
    try {
      res = await fetch(
        `${environment.CONVEX_SITE_URL}/api/auth/convex/token`,
        {
          method: 'GET',
          headers: { 'Better-Auth-Cookie': cookie },
          signal: controller.signal,
        },
      );
    } catch (err) {
      const aborted = (err as { name?: string } | null)?.name === 'AbortError';
      const reason: ConvexTokenAttempt['reason'] = aborted
        ? 'timeout'
        : 'network';
      this.recordTokenAttempt({
        startedAt,
        latencyMs: Math.round(performance.now() - t0),
        httpStatus: null,
        reason,
      });
      return { ok: false, reason };
    } finally {
      clearTimeout(timer);
    }

    const latencyMs = Math.round(performance.now() - t0);

    if (res.status === 401 || res.status === 403) {
      this.recordTokenAttempt({
        startedAt,
        latencyMs,
        httpStatus: res.status,
        reason: 'unauthorized',
      });
      return { ok: false, reason: 'unauthorized' };
    }
    if (!res.ok) {
      this.recordTokenAttempt({
        startedAt,
        latencyMs,
        httpStatus: res.status,
        reason: 'server-error',
      });
      return { ok: false, reason: 'server-error' };
    }

    try {
      const data = await res.json();
      const token = data?.token as string | undefined;
      if (!token) {
        this.recordTokenAttempt({
          startedAt,
          latencyMs: Math.round(performance.now() - t0),
          httpStatus: res.status,
          reason: 'server-error',
        });
        return { ok: false, reason: 'server-error' };
      }
      this.recordTokenAttempt({
        startedAt,
        latencyMs: Math.round(performance.now() - t0),
        httpStatus: res.status,
        reason: 'ok',
      });
      return { ok: true, token };
    } catch {
      this.recordTokenAttempt({
        startedAt,
        latencyMs: Math.round(performance.now() - t0),
        httpStatus: res.status,
        reason: 'server-error',
      });
      return { ok: false, reason: 'server-error' };
    }
  }

  /**
   * Registra una métrica de `getConvexToken` en el buffer y en consola.
   *
   * Niveles de log:
   * - `reason === 'ok'` y `latencyMs <= SLOW_THRESHOLD` → silencio (caso normal).
   * - `reason === 'ok'` con latencia alta → `console.warn` (sospechoso, anticipo de degradación).
   * - `reason === 'no-session'` → silencio (caso esperado en cold start sin login).
   * - Resto de reasons → `console.warn` con la métrica completa.
   *
   * Formato del log: `[ConvexToken] {...JSON}` para facilitar grep y parsing
   * desde un SDK de telemetría futuro. El buffer expuesto vía `tokenAttempts`
   * permite a la UI o devtools inspeccionar los últimos N intentos sin
   * necesidad de SDK externo.
   */
  private recordTokenAttempt(attempt: ConvexTokenAttempt): void {
    // Buffer rotativo (FIFO): añadimos al final, recortamos por el principio.
    const next = [...this._tokenAttempts(), attempt];
    if (next.length > TOKEN_METRICS_BUFFER_SIZE) {
      next.splice(0, next.length - TOKEN_METRICS_BUFFER_SIZE);
    }
    this._tokenAttempts.set(next);

    // Exponer en dev para inspección rápida (`window.__kengoTokenMetrics`).
    // En producción no se monta para no añadir ruido al objeto window.
    if (!environment.production && typeof window !== 'undefined') {
      (window as unknown as { __kengoTokenMetrics?: ConvexTokenAttempt[] }).__kengoTokenMetrics =
        next;
    }

    const isSlowOk =
      attempt.reason === 'ok' &&
      attempt.latencyMs > CONVEX_TOKEN_SLOW_THRESHOLD_MS;
    const isFailure =
      attempt.reason !== 'ok' && attempt.reason !== 'no-session';

    if (isFailure || isSlowOk) {
      console.warn('[ConvexToken]', JSON.stringify(attempt));
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
