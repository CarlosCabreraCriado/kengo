import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment as env } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { AppService } from './app.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private appService = inject(AppService);

  // Estado reactivo - solo indica si hay sesión activa
  readonly isLoggedIn = signal<boolean>(false);

  constructor() {
    // Verificar sesión al iniciar (sin bloquear)
    this.checkSession();
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
    await this.appService.cargarMiUsuario();
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
      await this.appService.cargarMiUsuario();
    }
  }

  // =========================
  //  MAGIC LINK (QR)
  // =========================

  /**
   * Genera un magic link para el usuario
   */
  initMagic(userId: string) {
    return this.http.post<{ url: string }>(
      `${env.API_URL}/crearMagicLink`,
      { userId },
      { withCredentials: true },
    );
  }

  /**
   * Consume un magic link y establece la sesión via cookie
   */
  async consumeMagic(token: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${env.API_URL}/consumirMagicLink`,
        { token },
        { withCredentials: true },
      ),
    );

    this.isLoggedIn.set(true);
    await this.appService.cargarMiUsuario();
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
}
