import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

//RXJS:
//import { BehaviorSubject } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

//Servicios:
import { AppService } from './app.service';
import { DirectusService } from './directus.service';

type LoginResponse = { data: Tokens };
type RefreshResponse = { data: Tokens };

interface AuthResponse {
  data: {
    access_token: string;
    refresh_token: string;
    expires: number;
  };
}

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires: number;
}

const STORAGE_KEY = 'auth_tokens';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private API_URL = 'https://admin.kengoapp.com';
  //currentUser$ = new BehaviorSubject<User | null | undefined>(undefined);
  //
  private http = inject(HttpClient);

  readonly accessToken = signal<string | null>(null);
  readonly refreshToken = signal<string | null>(null);
  readonly accessTokenExpMs = signal<number | null>(null);

  constructor(
    private router: Router,
    private appService: AppService,
    private directusService: DirectusService,
  ) {
    // Hydrate desde storage
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const t: Tokens = JSON.parse(raw);
      this.setTokens(t);
    }
  }

  async login(email: string, password: string) {
    this.removeTokens();

    // 1) Cookie de sesión (httpOnly) — se setea en el navegador
    await firstValueFrom(
      this.http.post(
        `${this.API_URL}/auth/login`,
        { email, password, mode: 'session' },
        { withCredentials: true },
      ),
    );

    const res = await firstValueFrom(
      this.http.post<{
        data: { access_token: string; refresh_token: string; expires: number };
      }>(`${this.API_URL}/auth/login`, { email, password, mode: 'json' }),
    );

    this.setTokens(res.data); // tu método que guarda access/refresh/exp
    this.appService.cargarMiUsuario();
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.API_URL}/auth/logout`,
          {},
          { withCredentials: true },
        ),
      );
    } finally {
      this.clearTokens();
      this.router.navigate(['/login']);
    }
  }

  obtenerMiUsuario() {
    return this.http.get(`${this.API_URL}/users/me`);
  }

  private setTokens(t: Tokens) {
    this.accessToken.set(t.access_token);
    this.refreshToken.set(t.refresh_token);
    // Directus devuelve `expires` en segundos → calculamos hora de expiración aproximada
    const expMs = Date.now() + t.expires * 1000 - 5000; // -5s de margen
    this.accessTokenExpMs.set(expMs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  }

  clearTokens() {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.accessTokenExpMs.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  async refresh(): Promise<void> {
    const rt = this.refreshToken();
    if (!rt) throw new Error('No refresh token');
    const res = await firstValueFrom(
      this.http.post<RefreshResponse>(`${this.API_URL}/auth/refresh`, {
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

  saveTokens(access: string, refresh: string) {
    this.directusService.setToken(access);
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  cargarUsuario(usuario: unknown) {
    console.log('Usuario cargado: ', usuario);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  removeTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}
