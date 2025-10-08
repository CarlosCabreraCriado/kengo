import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { environment as env } from '../../environments/environment'; // mantengo tu ruta

// RXJS
import { firstValueFrom } from 'rxjs';

// Servicios
import { AppService } from './app.service';

interface LoginResponse {
  data: Tokens;
}
interface RefreshResponse {
  data: Tokens;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires: number; // segundos
}

// ---- NUEVO: respuestas posibles al canje de Magic Link
type MagicConsumeResponse =
  | { appJwt: string } // tu BFF emite su propio JWT
  | { access_token: string; refresh_token?: string; expires?: number }; // tu extensión devuelve tokens de Directus

const APP_JWT_KEY = 'app_jwt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  // === Estado Directus (tu lógica previa) ===
  readonly accessToken = signal<string | null>(null);
  readonly refreshToken = signal<string | null>(null);
  readonly accessTokenExpMs = signal<number | null>(null);

  // === NUEVO: estado BFF (Magic con appJwt) ===
  readonly appJwt = signal<string | null>(null);

  // (opcional) Computada útil si la quieres en plantillas
  readonly isLoggedIn = computed(() => !!this.appJwt() || !!this.accessToken());

  constructor(
    private router: Router,
    private appService: AppService,
  ) {
    // Cargar de storage lo que tengas
    this.accessToken.set(this.getAccessToken());
    this.refreshToken.set(this.getRefreshToken());
    this.appJwt.set(localStorage.getItem(APP_JWT_KEY));
  }

  iniciarApp() {
    if (this.getAccessToken()) {
      this.appService.inicializarApp();
    }
  }

  // =========================
  //  LOGIN / LOGOUT DIRECTUS
  // =========================
  async login(email: string, password: string) {
    console.warn('Login con email y password:', email, password);
    this.eliminarTokens();

    // 1) Sesión por cookie httpOnly (si la usas en tu app)
    await firstValueFrom(
      this.http.post(
        `${env.DIRECTUS_URL}/auth/login`,
        { email, password, mode: 'session' },
        { withCredentials: true },
      ),
    );

    // 2) Tokens JSON (access/refresh) que ya usabas
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${env.DIRECTUS_URL}/auth/login`, {
        email,
        password,
        mode: 'json',
      }),
    );

    this.setTokens(res.data);
    this.appService.cargarMiUsuario();
  }

  async loginMagicLink(tokens: Tokens, email: string, pass: string) {
    console.log('Login con Magic Link, tokens:', tokens, email, pass);
    await firstValueFrom(
      this.http.post(
        `${env.DIRECTUS_URL}/auth/login`,
        { email: email, password: pass, mode: 'session' },
        { withCredentials: true },
      ),
    );

    this.setTokens(tokens);
    this.appService.cargarMiUsuario();
  }

  async logout(evitarRedirect?: boolean): Promise<void> {
    try {
      // Cierra sesión de Directus si existía
      await firstValueFrom(
        this.http.post(
          `${env.DIRECTUS_URL}/auth/logout`,
          {},
          { withCredentials: true },
        ),
      );
      return;
    } catch {
      // ignora error
      return;
    } finally {
      this.eliminarTokens();
      if (!evitarRedirect) {
        this.router.navigate(['/login']);
      }
    }
  }

  // =========================
  //  REFRESH DIRECTUS
  // =========================

  private setTokens(t: Tokens) {
    this.accessToken.set(t.access_token);
    this.refreshToken.set(t.refresh_token);

    // Directus devuelve expires en segundos → calcula hora (con margen)
    const expMs = Date.now() + t.expires * 1000 - 5000;
    this.accessTokenExpMs.set(expMs);

    localStorage.setItem('access_token', t.access_token);
    localStorage.setItem('refresh_token', t.refresh_token);
  }

  eliminarTokens() {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.accessTokenExpMs.set(null);
    this.appJwt.set(null);

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem(APP_JWT_KEY);
  }

  async refresh(): Promise<void> {
    const rt = this.refreshToken();
    if (!rt) throw new Error('No refresh token');

    const res = await firstValueFrom(
      this.http.post<RefreshResponse>(`${env.DIRECTUS_URL}/auth/refresh`, {
        mode: 'json',
        refresh_token: rt,
      }),
    );
    this.setTokens(res.data);
  }

  isAccessTokenExpiredSoon(thresholdMs = 30_000): boolean {
    const exp = this.accessTokenExpMs();
    if (!exp) return true;
    return Date.now() >= exp - thresholdMs;
  }

  // =========================
  //  HELPERS (tus métodos)
  // =========================

  cargarUsuario(usuario: unknown) {
    console.log('Usuario cargado: ', usuario);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  // === NUEVO
  getAppJwt(): string | null {
    return this.appJwt();
  }

  isAuthenticated(): boolean {
    // ahora considera también appJwt
    return !!this.getAccessToken() || !!this.getAppJwt();
  }

  // =========================
  //  MAGIC LINK (QR)
  // =========================

  /**
   * Pide al backend que genere un token efímero y devuelva la URL para el QR.
   * POST { userId } → { url }
   */
  initMagic(userId: string) {
    return this.http.post<{ url: string }>(`${env.API_URL}/crearMagicLink`, {
      userId,
    });
  }

  /**
   * Canjea el token de la URL /magic?token=... y establece sesión:
   * - Si backend devuelve { appJwt }, guardamos appJwt.
   * - Si devuelve tokens de Directus, guardamos access/refresh.
   */
  async consumeMagic(token: string) {
    const params = new HttpParams().set('token', token);
    const res = await firstValueFrom(
      this.http.get<MagicConsumeResponse>(`${env.API_URL}/consumirMagicLink`, {
        params,
      }),
    );
    this.setSessionFromMagic(res);
    // carga tu usuario logado si procede
    this.appService.cargarMiUsuario();
    return true;
  }

  /**
   * Unifica almacenamiento de sesión según lo devuelto por tu backend o extensión.
   */
  private setSessionFromMagic(res: MagicConsumeResponse) {
    if ('appJwt' in res) {
      // BFF con su JWT propio
      this.appJwt.set(res.appJwt);
      localStorage.setItem(APP_JWT_KEY, res.appJwt);

      // limpia tokens de Directus si los hubiera
      this.accessToken.set(null);
      this.refreshToken.set(null);
      this.accessTokenExpMs.set(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } else {
      // Directus access/refresh desde tu extensión
      const access = res.access_token;
      const refresh = res.refresh_token ?? null;
      const expires = res.expires ?? 3600; // por si no llega, asume 1h
      this.setTokens({
        access_token: access,
        refresh_token: refresh ?? '',
        expires,
      });

      // limpia appJwt si existía
      this.appJwt.set(null);
      localStorage.removeItem(APP_JWT_KEY);
    }
  }

  // =========================
  //  INVITACIONES (opcional)
  // =========================

  /**
   * Acepta una invitación de Directus con password elegido por el usuario.
   * Tras aceptar, el usuario puede hacer login normal.
   */
  async acceptInvite(token: string, password: string) {
    await firstValueFrom(
      this.http.post(`${env.DIRECTUS_URL}/users/invite/accept`, {
        token,
        password,
      }),
    );
  }
}
