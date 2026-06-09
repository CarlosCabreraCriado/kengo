import { Injectable, inject, signal } from '@angular/core';
import { RouteReuseStrategy, Router } from '@angular/router';
import { CustomRouteReuseStrategy } from '../../config/route-reuse-strategy';
import { environment as env } from '../../../../environments/environment';
import { SessionService } from './session.service';
import { ClinicaActivaService } from './clinica-activa.service';
import { BetterAuthService } from './better-auth.service';
import type { ConvexTokenResult } from './better-auth.service';
import { ConvexService } from '../../convex/convex.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { PageLoaderService } from '../../services/page-loader.service';
import { LoggerService } from '../../services/logger.service';
import { withTimeout } from '../../utils/with-timeout';

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
  private clinicaActiva = inject(ClinicaActivaService);
  private routeReuseStrategy = inject(RouteReuseStrategy) as CustomRouteReuseStrategy;
  private betterAuth = inject(BetterAuthService);
  private convex = inject(ConvexService);
  private pushNotifications = inject(PushNotificationService);
  private pageLoader = inject(PageLoaderService);
  private logger = inject(LoggerService);

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
    // Reactivar el caché de rutas tras un login exitoso. Se desactiva en
    // logout para evitar que el componente saliente quede como zombie.
    this.routeReuseStrategy.setCachingEnabled(true);
    await this.sessionService.cargarMiUsuario();
    // Tras login fresco: si el puesto en la clínica activa permite alternar
    // (fisio/admin), forzamos modo fisio ignorando la preferencia persistida.
    // `setRolUsuario` se autoignora si el puesto solo permite paciente.
    this.sessionService.setRolUsuario('fisio');
  }

  /**
   * Cierra sesión local-first: limpia el estado local y navega a `/login`
   * inmediatamente. La limpieza server-side (revocar push token, invalidar
   * cookie Better-Auth) se dispara en background con timeouts cortos.
   *
   * Razón: el try/catch del flujo anterior solo capturaba rechazos, no
   * promesas colgadas. `pushNotifications.teardown` (mutation Convex sin
   * timeout efectivo) y `betterAuth.authClient.signOut()` (fetch sin
   * AbortController) podían colgarse indefinidamente con la red degradada y
   * bloquear `limpiarEstadoLocal()` → el usuario nunca llegaba a `/login`.
   *
   * Si la mutation `unregisterPushToken` no llega al servidor por estar la
   * sesión ya limpiada, el token se desregistrará en el siguiente envío
   * cuando FCM responda UNREGISTERED.
   */
  async logout(evitarRedirect?: boolean): Promise<void> {
    // 1. Disparar cleanup server-side en background. Las mutations Convex
    //    aún pueden llegar al servidor con el token actual antes de que el
    //    paso 2 invalide la auth local. Cada paso tiene timeout corto.
    void this.cleanupServidorBackground();

    // 2. Limpieza local + navegación inmediatas (<100 ms).
    this.convex.clearAuth();
    this.limpiarEstadoLocal(evitarRedirect);
  }

  private async cleanupServidorBackground(): Promise<void> {
    try {
      await withTimeout(this.pushNotifications.teardown(), 2000);
    } catch (err) {
      this.logger.warn('[Logout] teardown push (background):', err);
    }
    try {
      await withTimeout(this.betterAuth.signOut(), 2000);
    } catch (err) {
      this.logger.warn('[Logout] betterAuth.signOut (background):', err);
    }
    // purgeStoredSession ya se invoca dentro de signOut. Si signOut hizo
    // timeout antes de purgar, lo intentamos aquí explícitamente — es
    // localStorage + Preferences, no puede colgarse.
    try {
      await this.betterAuth.purgeStoredSession();
    } catch (err) {
      this.logger.warn('[Logout] purgeStoredSession (background):', err);
    }
  }

  /**
   * Limpia el estado local (signals + cache de rutas + storage no esencial).
   *
   * Importante: desactiva el RouteReuseStrategy ANTES de navegar a /login.
   * Si dejáramos el caching activo, el componente saliente (p. ej. /inicio)
   * entraría al cache durante la navegación → su ngOnDestroy no se ejecuta →
   * sus registros en PageLoaderService quedarían colgados como zombies y el
   * overlay global se quedaría visible permanentemente sobre /login.
   */
  limpiarEstadoLocal(evitarRedirect?: boolean): void {
    this.isLoggedIn.set(false);
    this.routeReuseStrategy.setCachingEnabled(false);
    this.routeReuseStrategy.clearCache();
    // Defensa en profundidad: si algún componente quedó registrado por una vía
    // no estándar (effects raros, cache de RouteReuseStrategy aún no purgado,
    // edge cases que no anticipemos), garantizamos que el overlay no se queda
    // colgado tras logout.
    this.pageLoader.clearRegistry();
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

  // =========================
  //  IMPERSONACIÓN (soporte)
  // =========================

  /**
   * Impersona a un usuario objetivo (solo técnicos de soporte). Replica el flujo
   * post-login: tras el swap de sesión en Better-Auth, refresca el token Convex,
   * limpia el contexto del técnico y recarga la sesión como el usuario objetivo.
   * El gate real está en el servidor (`adminUserIds`): si el caller no es técnico,
   * `betterAuth.impersonate` devuelve 403 y abortamos.
   */
  async impersonar(target: {
    externalId: string;
    email: string;
    nombre: string;
  }): Promise<void> {
    // 1. Auditar el INICIO mientras seguimos autenticados como técnico.
    try {
      await this.convex.mutation(api.impersonation.mutations.logStart, {
        targetExternalId: target.externalId,
      });
    } catch (err) {
      // No bloqueamos la impersonación si solo falla la auditoría — el registro
      // nativo `session.impersonatedBy` es el backstop autoritativo.
      this.logger.warn('[Impersonar] logStart falló:', err);
    }

    // 2. Swap de sesión: Better-Auth emite la sesión del usuario objetivo.
    const res = await this.betterAuth.impersonate(target.externalId);
    if (!res.ok) {
      throw new Error(
        res.code === 'NETWORK_ERROR'
          ? 'NETWORK_ERROR'
          : 'IMPERSONACION_NO_AUTORIZADA',
      );
    }

    // 3. Refrescar token Convex con la nueva sesión (subject = objetivo).
    await this.convex.setAuth(() => this.betterAuth.getConvexToken());

    // 4. Limpiar contexto del técnico (cache de usuario + clínica activa) para no
    //    mezclar sus datos con los del usuario impersonado.
    this.sessionService.limpiarCacheUsuario();
    this.clinicaActiva.clear();

    // 5. Marcar impersonación activa (banner) y recargar como el objetivo.
    this.sessionService.setImpersonacion({
      targetExternalId: target.externalId,
      targetEmail: target.email,
      targetNombre: target.nombre,
    });
    await this.sessionService.cargarMiUsuario();
    this.isLoggedIn.set(true);
    this.routeReuseStrategy.setCachingEnabled(true);

    // 6. Entrar como el usuario objetivo.
    this.router.navigate(['/inicio']);
  }

  /**
   * Termina la impersonación y restaura la sesión del técnico.
   */
  async salirDeImpersonacion(): Promise<void> {
    const info = this.sessionService.impersonacion();

    // 1. Restaurar la sesión del técnico en Better-Auth.
    await this.betterAuth.stopImpersonating();

    // 2. Refrescar token Convex (subject = técnico de nuevo).
    await this.convex.setAuth(() => this.betterAuth.getConvexToken());

    // 3. Limpiar contexto del usuario impersonado y el flag de impersonación.
    this.sessionService.limpiarCacheUsuario();
    this.clinicaActiva.clear();
    this.sessionService.clearImpersonacion();

    // 4. Recargar como el técnico.
    await this.sessionService.cargarMiUsuario();
    this.isLoggedIn.set(true);
    this.routeReuseStrategy.setCachingEnabled(true);

    // 5. Auditar el FIN (ya autenticados como técnico).
    if (info) {
      try {
        await this.convex.mutation(api.impersonation.mutations.logStop, {
          targetExternalId: info.targetExternalId,
        });
      } catch (err) {
        this.logger.warn('[Impersonar] logStop falló:', err);
      }
    }

    // 6. Volver a la pantalla de soporte.
    this.router.navigate(['/soporte']);
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
        // unauthorized / no-session: la cookie en localStorage existía pero
        // el servidor la ha rechazado. Es un estado zombie — purgamos el
        // rastro local para que el siguiente arranque vea hasStoredSession=
        // false y no entre en bucle de 401. No redirigimos desde aquí; el
        // AuthGuard se encargará al activar una ruta protegida.
        this.logger.warn(
          '[AuthService] Sesión inválida en servidor — purgando estado local',
        );
        await this.betterAuth.purgeStoredSession();
        this.convex.clearAuth();
        this.sessionService.limpiar();
        this.isLoggedIn.set(false);
        return;
      }

      this.isLoggedIn.set(true);
      // Reactivar caché de rutas al restaurar sesión válida (cubre el caso
      // de reload tras logout o cold start con sesión persistida).
      this.routeReuseStrategy.setCachingEnabled(true);
      await this.sessionService.cargarMiUsuario();
    } finally {
      this.sessionService.marcarSesionInicializada();
    }
  }

  /**
   * Reintenta la inicialización tras un error de conexión. Usado por la
   * pantalla de error de conexión. Fuerza re-ejecución aunque `iniciarApp`
   * ya se hubiera completado.
   *
   * Resetea explícitamente `tokenError` para que el overlay desaparezca
   * mientras el reintento está en vuelo: si vuelve a fallar, `applyAuthResult`
   * lo reactivará; si tiene éxito, no reaparece.
   */
  async reintentarConexion(): Promise<void> {
    this.convex.resetTokenError();
    this.sessionService.limpiarErrorConexion();
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
    opciones?: {
      usosMaximos?: number;
      diasExpiracion?: number;
      /**
       * Clínica activa del fisio. El backend la usa para validar suscripción
       * estrictamente contra esa clínica (regla multiclínica: la activa manda).
       */
      clinicId?: string;
    },
  ): Promise<{ id: string; url: string }> {
    return await this.convex.mutation(api.accessTokens.mutations.create, {
      userId: userId as never,
      usosMaximos: opciones?.usosMaximos,
      diasExpiracion: opciones?.diasExpiracion,
      clinicId: opciones?.clinicId as never,
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

  async enviarTokenPorEmail(
    userId: string,
    /**
     * Clínica activa del fisio. El backend la usa para validar suscripción
     * estrictamente contra esa clínica (regla multiclínica).
     */
    clinicId?: string,
  ): Promise<void> {
    await this.convex.action(api.accessTokens.actions.sendByEmail, {
      userId,
      clinicId: clinicId as never,
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
    this.routeReuseStrategy.setCachingEnabled(true);

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
    // Action pública: el usuario aún no tiene sesión.
    const result = await this.convex.action(
      api.auth.actions.register,
      {
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        email: payload.email.toLowerCase().trim(),
        password: payload.password,
        codigo_clinica: payload.codigo_clinica?.trim(),
      },
      { requireAuth: false },
    );
    return result as RegistroResult;
  }

  // =========================
  //  RECUPERACIÓN DE CONTRASEÑA
  // =========================

  async solicitarRecuperacion(
    email: string,
  ): Promise<SolicitarRecuperacionResult> {
    // Action pública: se invoca desde el formulario de recuperación sin sesión.
    return await this.convex.action(
      api.auth.actions.requestPasswordReset,
      { email: email.toLowerCase().trim() },
      { requireAuth: false },
    );
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
