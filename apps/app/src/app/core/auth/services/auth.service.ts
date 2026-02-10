import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment as env } from '../../../../environments/environment';
import { firstValueFrom } from 'rxjs';
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

  constructor() {
    // No verificar sesión aquí — iniciarApp() y AuthGuard se encargan
  }

  /**
   * Inicia sesión con email y password usando cookies httpOnly
   */
  async login(email: string, password: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${env.DIRECTUS_URL}/auth/login`,
        { email, password, mode: 'session' },
        { withCredentials: true },
      ),
    );

    this.isLoggedIn.set(true);
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
          {},
          { withCredentials: true },
        ),
      );
    } catch {
      // Ignorar error de logout
    } finally {
      this.isLoggedIn.set(false);
      if (!evitarRedirect) {
        this.router.navigate(['/login']);
      }
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
      await this.sessionService.cargarMiUsuario();
    }
  }

  // =========================
  //  TOKENS DE ACCESO (QR)
  // =========================

  /**
   * Crea un token de acceso para el usuario
   */
  crearTokenAcceso(userId: string, opciones?: { usosMaximos?: number; diasExpiracion?: number }) {
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
  async consumirTokenAcceso(token: string): Promise<{ tienePassword: boolean; email: string }> {
    const res = await firstValueFrom(
      this.http.post<{ ok: boolean; tienePassword: boolean; email: string }>(
        `${env.API_URL}/auth/token-acceso`,
        { token },
        { withCredentials: true },
      ),
    );

    this.isLoggedIn.set(true);

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
      this.http.post<RegistroResult>(
        `${env.API_URL}/registro`,
        payload,
        { withCredentials: true },
      ),
    );
  }

  // =========================
  //  RECUPERACION DE CONTRASENA
  // =========================

  /**
   * Solicita un codigo de recuperacion de contrasena
   */
  async solicitarRecuperacion(email: string): Promise<SolicitarRecuperacionResult> {
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
  async resetPassword(email: string, codigo: string, nuevaPassword: string): Promise<ResetPasswordResult> {
    return firstValueFrom(
      this.http.post<ResetPasswordResult>(
        `${env.API_URL}/auth/reset-password`,
        { email, codigo, nuevaPassword },
      ),
    );
  }
}
