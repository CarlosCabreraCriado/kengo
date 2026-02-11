import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment as env } from '../../../../environments/environment';
import { BehaviorSubject, firstValueFrom, filter, take } from 'rxjs';
import { SessionService } from './session.service';
import type {
  CreateUsuarioPayload,
  RegistroResult,
  SolicitarRecuperacionResult,
  ResetPasswordResult,
} from '@kengo/shared-models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private sessionService = inject(SessionService);

  // Estado reactivo - solo indica si hay sesión activa
  readonly isLoggedIn = signal<boolean>(false);

  // Coordinación de refresh concurrente
  private isRefreshing = false;
  private refreshResult$ = new BehaviorSubject<boolean | null>(null);

  // Timer de refresh proactivo
  private refreshTimerId: ReturnType<typeof setInterval> | null = null;
  private lastRefreshTime = 0;
  private readonly REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 min (buffer de 2 min antes de expiración de 15 min)

  constructor() {
    // No verificar sesión aquí — iniciarApp() y AuthGuard se encargan
  }

  /**
   * Inicia sesión con email y password usando cookies httpOnly.
   * Limpia cookies expiradas antes para evitar que Directus rechace la petición.
   */
  async login(email: string, password: string): Promise<void> {
    console.log('Realizando login');
    await this.limpiarSesionExpirada();

    await firstValueFrom(
      this.http.post(
        `${env.DIRECTUS_URL}/auth/login`,
        { email, password, mode: 'session' },
        { withCredentials: true },
      ),
    );

    this.isLoggedIn.set(true);
    this.iniciarTimerRefresh();
    await this.sessionService.cargarMiUsuario();
  }

  /**
   * Cierra sesión y limpia cookies
   */
  async logout(evitarRedirect?: boolean): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${env.DIRECTUS_URL}/auth/logout`,
          { mode: 'session' },
          { withCredentials: true },
        ),
      );
    } catch {
      // Ignorar error de logout
    } finally {
      this.limpiarEstadoLocal(evitarRedirect);
    }
  }

  /**
   * Limpia solo el estado local sin hacer petición HTTP.
   * Útil cuando el token ya expiró y sabemos que la petición de logout fallaría.
   */
  limpiarEstadoLocal(evitarRedirect?: boolean): void {
    this.detenerTimerRefresh();
    this.isLoggedIn.set(false);
    if (!evitarRedirect) {
      this.router.navigate(['/login'], { state: { fromLogout: true } });
    }
  }

  /**
   * Refresca la sesión Directus. Coordina múltiples peticiones concurrentes
   * para que solo una haga el refresh y las demás esperen el resultado.
   */
  async handleRefresh(): Promise<boolean> {
    if (this.isRefreshing) {
      return firstValueFrom(
        this.refreshResult$.pipe(
          filter((result): result is boolean => result !== null),
          take(1),
        ),
      );
    }

    this.isRefreshing = true;
    this.refreshResult$.next(null);

    try {
      // Intento 1: Directus refresh nativo (funciona si JWT aún es válido)
      try {
        await firstValueFrom(
          this.http.post(
            `${env.DIRECTUS_URL}/auth/refresh`,
            { mode: 'session' },
            { withCredentials: true },
          ),
        );
        this.isLoggedIn.set(true);
        this.lastRefreshTime = Date.now();
        this.refreshResult$.next(true);
        return true;
      } catch {
        // JWT probablemente expirado, intentar endpoint custom
      }

      // Intento 2: Endpoint custom (funciona con JWT expirado si sesión BD vigente)
      try {
        await firstValueFrom(
          this.http.post(
            `${env.API_URL}/auth/refrescar-sesion`,
            {},
            { withCredentials: true },
          ),
        );
        this.isLoggedIn.set(true);
        this.lastRefreshTime = Date.now();
        this.refreshResult$.next(true);
        return true;
      } catch {
        // Ambos intentos fallaron — sesión muerta
      }

      this.refreshResult$.next(false);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Intenta limpiar una sesión/cookie expirada antes del login.
   *
   * Problema: si hay una cookie httpOnly con JWT expirado, Directus rechaza
   * TODAS las peticiones (incluyendo /auth/login y /auth/logout) con TOKEN_EXPIRED.
   *
   * Solución: nuestro endpoint custom /auth/refrescar-sesion acepta JWTs expirados
   * (verifica firma ignorando expiración). Refrescamos para obtener una cookie válida,
   * y luego hacemos logout para limpiarla.
   */
  async limpiarSesionExpirada(): Promise<void> {
    // 1. Refrescar con endpoint custom (acepta JWTs expirados)
    try {
      await firstValueFrom(
        this.http.post(
          `${env.API_URL}/auth/refrescar-sesion`,
          {},
          { withCredentials: true },
        ),
      );
    } catch {
      // Si falla (sesión no existe en BD o no hay cookie), no hay nada que limpiar
      return;
    }

    // 2. Ahora la cookie es válida — logout la elimina correctamente
    try {
      await firstValueFrom(
        this.http.post(
          `${env.DIRECTUS_URL}/auth/logout`,
          { mode: 'session' },
          { withCredentials: true },
        ),
      );
    } catch {
      // Ignorar — si logout falla con cookie válida, algo raro pasó
    }
  }

  /**
   * Verifica si hay una sesión activa consultando al servidor
   */
  async checkSession(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.get(`${env.DIRECTUS_URL}/users/me`, {
          withCredentials: true,
        }),
      );
      this.isLoggedIn.set(true);
      return true;
    } catch {
      this.isLoggedIn.set(false);
      return false;
    }
  }

  /**
   * Verifica autenticación de forma síncrona (basado en estado local)
   */
  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  /**
   * Inicializa la app si hay sesión activa
   */
  async iniciarApp(): Promise<void> {
    const hasSession = await this.checkSession();
    if (hasSession) {
      this.iniciarTimerRefresh();
      await this.sessionService.cargarMiUsuario();
    }
  }

  // =========================
  //  TOKENS DE ACCESO (QR)
  // =========================

  /**
   * Crea un token de acceso para el usuario
   */
  crearTokenAcceso(
    userId: string,
    opciones?: { usosMaximos?: number; diasExpiracion?: number },
  ) {
    return this.http.post<{ id: string; url: string }>(
      `${env.API_URL}/usuario/token-acceso`,
      { idUsuario: userId, ...opciones },
      { withCredentials: true },
    );
  }

  /**
   * Consume un token de acceso y establece la sesión via cookie.
   * Devuelve si el usuario tiene contraseña y su email.
   * No carga el usuario aquí — el AuthGuard de la ruta destino se encarga.
   */
  async consumirTokenAcceso(
    token: string,
  ): Promise<{ tienePassword: boolean; email: string }> {
    const res = await firstValueFrom(
      this.http.post<{ ok: boolean; tienePassword: boolean; email: string }>(
        `${env.API_URL}/auth/token-acceso`,
        { token },
        { withCredentials: true },
      ),
    );

    this.isLoggedIn.set(true);
    this.iniciarTimerRefresh();

    return {
      tienePassword: res.tienePassword,
      email: res.email,
    };
  }

  /**
   * Establece contraseña para un usuario que no la tiene (post magic link)
   */
  async establecerPassword(password: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${env.API_URL}/auth/establecer-password`,
        { password },
        { withCredentials: true },
      ),
    );
  }

  // =========================
  //  INVITACIONES
  // =========================

  /**
   * Acepta una invitación de Directus con password elegido por el usuario
   */
  async acceptInvite(token: string, password: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${env.DIRECTUS_URL}/users/invite/accept`,
        { token, password },
        { withCredentials: true },
      ),
    );
  }

  // =========================
  //  REGISTRO
  // =========================

  /**
   * Registra un nuevo usuario en el sistema
   */
  async register(payload: CreateUsuarioPayload): Promise<RegistroResult> {
    return firstValueFrom(
      this.http.post<RegistroResult>(`${env.API_URL}/registro`, payload, {
        withCredentials: true,
      }),
    );
  }

  // =========================
  //  RECUPERACION DE CONTRASENA
  // =========================

  /**
   * Solicita un codigo de recuperacion de contrasena
   */
  async solicitarRecuperacion(
    email: string,
  ): Promise<SolicitarRecuperacionResult> {
    return firstValueFrom(
      this.http.post<SolicitarRecuperacionResult>(
        `${env.API_URL}/auth/recuperar-password`,
        { email },
      ),
    );
  }

  /**
   * Restablece la contrasena usando el codigo de verificacion
   */
  async resetPassword(
    email: string,
    codigo: string,
    nuevaPassword: string,
  ): Promise<ResetPasswordResult> {
    return firstValueFrom(
      this.http.post<ResetPasswordResult>(
        `${env.API_URL}/auth/reset-password`,
        { email, codigo, nuevaPassword },
      ),
    );
  }

  // =========================
  //  REFRESH PROACTIVO
  // =========================

  private iniciarTimerRefresh(): void {
    this.detenerTimerRefresh();
    this.lastRefreshTime = Date.now();

    this.refreshTimerId = setInterval(() => {
      this.ejecutarRefreshProactivo();
    }, this.REFRESH_INTERVAL_MS);

    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private detenerTimerRefresh(): void {
    if (this.refreshTimerId) {
      clearInterval(this.refreshTimerId);
      this.refreshTimerId = null;
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible') return;
    const elapsed = Date.now() - this.lastRefreshTime;
    // Si pasaron más de 12 min desde el último refresh, refrescar inmediatamente
    if (elapsed > 12 * 60 * 1000) {
      this.ejecutarRefreshProactivo();
    }
  };

  private async ejecutarRefreshProactivo(): Promise<void> {
    const ok = await this.handleRefresh();
    if (!ok) {
      this.detenerTimerRefresh();
      this.limpiarEstadoLocal();
    }
  }
}
