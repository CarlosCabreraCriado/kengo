import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

//RXJS:
//import { BehaviorSubject } from 'rxjs';
import { tap, map } from 'rxjs/operators';

//Servicios:
import { AppService } from './app.service';
import { DirectusService } from './directus.service';

interface AuthResponse {
  data: {
    access_token: string;
    refresh_token: string;
    expires: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private API_URL = 'https://admin.kengoapp.com';
  //currentUser$ = new BehaviorSubject<User | null | undefined>(undefined);

  constructor(
    private http: HttpClient,
    private router: Router,
    private appService: AppService,
    private directusService: DirectusService,
  ) {}

  login(email: string, password: string) {
    this.removeTokens();
    return this.http
      .post<AuthResponse>(`${this.API_URL}/auth/login`, {
        email,
        password,
      })
      .pipe(
        tap((res) => {
          //Si el login es correcoto, guardamos los tokens en localStorage:
          this.saveTokens(res.data.access_token, res.data.refresh_token);
          this.appService.cargarMiUsuario();
        }),
        map(() => undefined), // Devolvemos un Observable<void>, sin exponer los tokens al componente
      );
  }

  obtenerMiUsuario() {
    return this.http.get(`${this.API_URL}/users/me`);
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

  logout() {
    this.removeTokens();
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}
