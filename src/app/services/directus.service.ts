import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Ejercicio, Usuario } from '../models/Global';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

interface DirectusResponse<T> {
  data: T;
}

@Injectable({ providedIn: 'root' })
export class DirectusService {
  private API_DIRECTUS_URL = 'https://admin.kengoapp.com';
  private token: string | null = null;

  constructor(private http: HttpClient) {
    if (!this.token) {
      this.token = localStorage.getItem('access_token');
    }
  }

  setToken(token: string) {
    this.token = token;
  }

  getMiUsuario() {
    return this.http.get<DirectusResponse<Usuario>>(
      `${this.API_DIRECTUS_URL}/users/me`,
    );
  }

  getEjercicios() {
    const headers = this.token
      ? new HttpHeaders({ Authorization: `Bearer ${this.token}` })
      : undefined;

    return this.http
      .get<DirectusResponse<Ejercicio[]>>(
        `${this.API_DIRECTUS_URL}/items/ejercicios`,
        {
          headers,
        },
      )
      .pipe(
        map((response) => {
          const ejerciciosConImagenUrl = response.data.map((ejercicio) => ({
            ...ejercicio,
            portada_url: ejercicio.portada
              ? `${this.API_DIRECTUS_URL}/assets/${ejercicio.portada}?access_token=${this.token}`
              : undefined,
            video_url: ejercicio.video
              ? `${this.API_DIRECTUS_URL}/assets/${ejercicio.video}?access_token=${this.token}`
              : undefined,
          }));
          return { ...response, data: ejerciciosConImagenUrl };
        }),
      );
  }

  getEjercicioById(id: number): Observable<Ejercicio> {
    return this.http
      .get<{
        data: Ejercicio;
      }>(
        `${this.API_DIRECTUS_URL}/items/ejercicios/${id}?access_token=${this.token}`,
      )
      .pipe(map((res) => res.data));
  }
}
