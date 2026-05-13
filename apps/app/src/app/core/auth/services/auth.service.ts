import { Injectable, inject, signal } from '@angular/core';
import { RouteReuseStrategy, Router } from '@angular/router';
import { CustomRouteReuseStrategy } from '../../config/route-reuse-strategy';
import { environment as env } from '../../../../environments/environment';
import { SessionService } from './session.service';
import { BetterAuthService } from './better-auth.service';
import type { ConvexTokenResult } from './better-auth.service';
import { ConvexService } from '../../convex/convex.service';
import { PushNotificationService } from '../../services/push-notification.service';

export type CheckSessionResult =
  | 'ok'
  | 'no-session'
  | 'network-error'
  | 'unauthorized';
import type {
  CreateUsuarioPayload,
  RegistroResult,
  SolicitarRecuperacionResult,
  ResetPasswordResult,
} from '@kengo/shared-models';
import { api } from '../../../../../../../convex/_generated/api';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private routeReuseStrategy = inject(RouteReuseStrategy) as CustomRouteReuseStrategy;
  private betterAuth = inject(BetterAuthService);
  private convex = inject(ConvexService);
  private pushNotifications = inject(PushNotificationService);

  // Estado reactivo - solo indica si hay sesión activa
  readonly isLoggedIn = signal<boolean>(false);

  /**
   * Inicia sesión vía Better-Auth (Convex). Better-Auth gestiona el refresh
   * automático del token; no necesitamos timer propio.
   */
  async login(email: string, password: string): Promise<void> {
    const result = await this.betterAuth.signIn(email, password);
    if (!result.ok) throw new Error('CREDENCIALES_INCORRECTAS');

    await this.convex.setAuth(() => this.betterAuth.getConvexToken());
    this.isLoggedIn.set(true);
    await this.sessionService.cargarMiUsuario();
  }

  /**
   * Cierra sesión: limpia Better-Auth + Convex + estado local.
   *
   * El push token se borra ANTES de invalidar el auth de Convex para que la
   * mutation `unregisterPushToken` se autentique correctamente; si falla
   * (offline, etc.) se ignora — el token se limpiará en el siguiente envío
   * cuando FCM responda UNREGISTERED.
   */
  async logout(evitarRedirect?: boolean): Promise<void> {
    await this.pushNotifications.teardown();
    try {
      await this.betterAuth.signOut();
    } catch {
      // ignorar
    }
    this.convex.clearAuth();
    this.limpiarEstadoLocal(evitarRedirect);
  }

  /**
   * Limpia el estado local (signals + cache de rutas + storage no esencial).
   */
  limpiarEstadoLocal(evitarRedirect?: boolean): void {
    this.isLoggedIn.set(false);
    this.routeReuseStrategy.clearCache();
    localStorage.removeItem('kengo:theme:v1');
    localStorage.removeItem('kengo:modo');
    this.sessionService.limpiar();
    if (!evitarRedirect) {
      this.router.navigate(['/login'], { state: { fromLogout: true } });
    }
  }

  /**
   * Verifica si hay sesión activa consultando Convex.
   * Better-Auth gestiona el token; si la cookie sigue válida la query a `me`
   * devuelve el usuario y consideramos sesión activa.
   */
  async checkSession(): Promise<CheckSessionResult> {
    if (!this.betterAuth.hasStoredSession()) {
      this.isLoggedIn.set(false);
      return 'no-session';
    }

    // Si el último intento de obtener token falló por red/5xx, propagamos
    // ese estado sin tirar otra query (que también colgaría).
    if (this.convex.tokenError()) {
      this.isLoggedIn.set(false);
      return 'network-error';
    }

    try {
      const user = await this.convex.query(api.users.queries.me, {});
      if (user) {
        this.isLoggedIn.set(true);
        return 'ok';
      }
      this.isLoggedIn.set(false);
      return 'no-session';
    } catch {
      // Si la query falla y el tokenError se rellenó durante el intento,
      // es un problema de red. Si no, asumimos sesión inválida.
      this.isLoggedIn.set(false);
      return this.convex.tokenError() ? 'network-error' : 'unauthorized';
    }
  }

  /**
   * Verifica autenticación de forma síncrona (basado en estado local).
   */
  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  /**
   * Inicializa la app si hay sesión activa.
   *
   * Si hay sesión guardada y la obtención del token Convex falla por red/5xx,
   * marca `errorConexion` en `SessionService` para que se muestre la pantalla
   * de reintento en vez de redirigir al login.
   *
   * Idempotente por boot: la primera llamada arranca el flujo, las siguientes
   * (ej. AuthGuard tras AppComponent) se enganchan a la misma promesa. Tras
   * completarse, llamadas posteriores son no-op para evitar reinicializaciones
   * en cada navegación. Para forzar re-ejecución usar `reintentarConexion`.
   */
  private inicializacionEnCurso: Promise<void> | null = null;
  private inicializacionCompletada = false;

  iniciarApp(): Promise<void> {
    if (this.inicializacionEnCurso) return this.inicializacionEnCurso;
    if (this.inicializacionCompletada) return Promise.resolve();
    this.inicializacionEnCurso = this.ejecutarIniciarApp().finally(() => {
      this.inicializacionCompletada = true;
      this.inicializacionEnCurso = null;
    });
    return this.inicializacionEnCurso;
  }

  private async ejecutarIniciarApp(): Promise<void> {
    try {
      // En native: rehidratar localStorage desde @capacitor/preferences si la
      // WebView purgó el storage. No-op en web.
      await this.betterAuth.restoreFromNative();
      this.sessionService.limpiarErrorConexion();

      if (!this.betterAuth.hasStoredSession()) {
        this.isLoggedIn.set(false);
        return;
      }

      const tokenResult = await this.restaurarConvexAuth();
      if (!tokenResult.ok) {
        if (
          tokenResult.reason === 'timeout' ||
          tokenResult.reason === 'network' ||
          tokenResult.reason === 'server-error'
        ) {
          // Sesión sigue válida, pero servidor no responde. UI mostrará overlay.
          this.sessionService.marcarErrorConexion();
          return;
        }
        // unauthorized / no-session: sesión real inválida.
        this.isLoggedIn.set(false);
        return;
      }

      this.isLoggedIn.set(true);
      await this.sessionService.cargarMiUsuario();
    } finally {
      this.sessionService.marcarSesionInicializada();
    }
  }

  /**
   * Reintenta la inicialización tras un error de conexión. Usado por la
   * pantalla de error de conexión. Fuerza re-ejecución aunque `iniciarApp`
   * ya se hubiera completado.
   */
  async reintentarConexion(): Promise<void> {
    if (this.inicializacionEnCurso) {
      await this.inicializacionEnCurso;
      return;
    }
    this.inicializacionEnCurso = this.ejecutarIniciarApp().finally(() => {
      this.inicializacionCompletada = true;
      this.inicializacionEnCurso = null;
    });
    await this.inicializacionEnCurso;
  }

  // =========================
  //  TOKENS DE ACCESO (QR)
  // =========================

  async crearTokenAcceso(
    userId: string,
    opciones?: { usosMaximos?: number; diasExpiracion?: number },
  ): Promise<{ id: string; url: string }> {
    return await this.convex.mutation(api.accessTokens.mutations.create, {
      userId: userId as never,
      usosMaximos: opciones?.usosMaximos,
      diasExpiracion: opciones?.diasExpiracion,
    });
  }

  async listarTokensAcceso(userId: string) {
    return await this.convex.query(api.accessTokens.queries.listByUser, {
      userId: userId as never,
    });
  }

  async revocarTokenAcceso(tokenId: string): Promise<void> {
    await this.convex.mutation(api.accessTokens.mutations.revoke, {
      id: tokenId as never,
    });
  }

  async enviarTokenPorEmail(userId: string): Promise<void> {
    await this.convex.action(api.accessTokens.actions.sendByEmail, {
      userId,
    });
  }

  /**
   * Consume un access token (QR / magic link) vía Convex.
   * Flujo: Convex valida el access token → genera un magic link Better-Auth →
   * el cliente lo verifica → Better-Auth establece sesión Convex.
   */
  async consumirTokenAcceso(
    token: string,
  ): Promise<{ tienePassword: boolean; email: string }> {
    const res = await fetch(
      `${env.CONVEX_SITE_URL}/api/auth/consume-access-token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      },
    );

    const body = (await res.json()) as {
      success: boolean;
      error?: string;
      magicLinkToken?: string;
      email?: string;
    };

    if (!body.success || !body.magicLinkToken || !body.email) {
      throw new Error(body.error ?? 'ERROR_CONSUMIENDO_TOKEN');
    }

    const ok = await this.betterAuth.verifyMagicLink(body.magicLinkToken);
    if (!ok) throw new Error('ERROR_VERIFICANDO_MAGIC_LINK');

    await this.convex.setAuth(() => this.betterAuth.getConvexToken());
    this.isLoggedIn.set(true);

    return { tienePassword: false, email: body.email };
  }

  /**
   * Establece contraseña para un usuario sin password (post magic link).
   * Usa el endpoint HTTP `/api/auth/convex-set-password` que delega en Better-Auth.
   */
  async establecerPassword(password: string): Promise<void> {
    const email = this.sessionService.usuario()?.email;
    if (!email) throw new Error('Usuario no autenticado');

    const res = await fetch(`${env.CONVEX_SITE_URL}/api/auth/convex-set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({ success: false }));
    if (!res.ok || !body?.success) {
      throw new Error(body?.message || 'Error al establecer la contraseña');
    }
  }

  // =========================
  //  REGISTRO
  // =========================

  async register(payload: CreateUsuarioPayload): Promise<RegistroResult> {
    const result = await this.convex.action(api.auth.actions.register, {
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      email: payload.email.toLowerCase().trim(),
      password: payload.password,
      codigo_clinica: payload.codigo_clinica?.trim(),
    });
    return result as RegistroResult;
  }

  // =========================
  //  RECUPERACIÓN DE CONTRASEÑA
  // =========================

  async solicitarRecuperacion(
    email: string,
  ): Promise<SolicitarRecuperacionResult> {
    return await this.convex.action(api.auth.actions.requestPasswordReset, {
      email: email.toLowerCase().trim(),
    });
  }

  async resetPassword(
    email: string,
    codigo: string,
    nuevaPassword: string,
  ): Promise<ResetPasswordResult> {
    const res = await fetch(`${env.CONVEX_SITE_URL}/api/auth/convex-reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        codigo,
        nuevaPassword,
      }),
    });
    return (await res.json()) as ResetPasswordResult;
  }

  // =========================
  //  CONVEX AUTH BRIDGE
  // =========================

  /**
   * Restaura la auth de Convex si hay sesión Better-Auth guardada en
   * localStorage. Devuelve el resultado para que el caller pueda reaccionar a
   * fallos de red (mostrar pantalla de reintento) o de sesión (limpiar).
   */
  private async restaurarConvexAuth(): Promise<ConvexTokenResult> {
    if (!this.betterAuth.hasStoredSession()) {
      return { ok: false, reason: 'no-session' };
    }
    return this.convex.setAuth(() => this.betterAuth.getConvexToken());
  }
}
