import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment as env } from '../../environments/environment';

//RXJS:
import { firstValueFrom } from 'rxjs';

//Servicios:
import { AppService } from './app.service';

interface LoginResponse {
  data: Tokens;
}
interface RefreshResponse {
  data: Tokens;
}

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  //currentUser$ = new BehaviorSubject<User | null | undefined>(undefined);
  //
  private http = inject(HttpClient);

  readonly accessToken = signal<string | null>(null);
  readonly refreshToken = signal<string | null>(null);
  readonly accessTokenExpMs = signal<number | null>(null);

  constructor(
    private router: Router,
    private appService: AppService,
  ) {
    this.accessToken.set(this.getAccessToken());
    this.refreshToken.set(this.getRefreshToken());
  }

  async login(email: string, password: string) {
    this.eliminarTokens();

    // 1) Cookie de sesión (httpOnly) — se setea en el navegador
    await firstValueFrom(
      this.http.post(
        `${env.DIRECTUS_URL}/auth/login`,
        { email, password, mode: 'session' },
        { withCredentials: true },
      ),
    );

    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${env.DIRECTUS_URL}/auth/login`, {
        email,
        password,
        mode: 'json',
      }),
    );

    this.setTokens(res.data); // tu método que guarda access/refresh/exp
    this.appService.cargarMiUsuario();
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${env.DIRECTUS_URL}/auth/logout`,
          {},
          { withCredentials: true },
        ),
      );
    } finally {
      this.eliminarTokens();
      this.router.navigate(['/login']);
    }
  }

  private setTokens(t: Tokens) {
    this.accessToken.set(t.access_token);
    this.refreshToken.set(t.refresh_token);
    // Directus devuelve `expires` en segundos → calculamos hora de expiración aproximada
    const expMs = Date.now() + t.expires * 1000 - 5000; // -5s de margen
    this.accessTokenExpMs.set(expMs);

    localStorage.setItem('access_token', t.access_token);
    localStorage.setItem('refresh_token', t.refresh_token);
  }

  eliminarTokens() {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.accessTokenExpMs.set(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  async refresh(): Promise<void> {
    const rt = this.refreshToken();
    if (!rt) throw new Error('No refresh token');

    console.error('Refrescando token...', rt);
    const res = await firstValueFrom(
      this.http.post<RefreshResponse>(`${env.DIRECTUS_URL}/auth/refresh`, {
        mode: 'json',
        refresh_token: rt,
      }),
    );
    console.error('Respuesta refresh:', res);

    /*
    const res = await firstValueFrom(
      this.http.post<RefreshResponse>(
        `${this.API_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      ),
    );
    */
    this.setTokens(res.data);
  }

  isAccessTokenExpiredSoon(thresholdMs = 30_000): boolean {
    const exp = this.accessTokenExpMs();
    if (!exp) return true;
    return Date.now() >= exp - thresholdMs;
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

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}
