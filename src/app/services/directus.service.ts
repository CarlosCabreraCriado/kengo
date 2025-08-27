import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Categoria, Ejercicio, Usuario } from '../models/Global';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

interface DirectusResponse<T> {
  data: T;
}

export interface PaginaEjercicios<T> {
  data: T[];
  meta: { total_count?: number; filter_count?: number };
}

@Injectable({ providedIn: 'root' })
export class DirectusService {
  private API_DIRECTUS_URL = 'https://admin.kengoapp.com';
  private token: string | null = null;

  get directusUrl() {
    return this.API_DIRECTUS_URL;
  }

  private headers(): HttpHeaders {
    let h = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (this.token) {
      h = h.set('Authorization', `Bearer ${this.token}`);
    }
    return h;
  }

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
    return this.http
      .get<
        DirectusResponse<Ejercicio[]>
      >(`${this.API_DIRECTUS_URL}/items/ejercicios`, {})
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

  getCategorias(limit = 200) {
    // Si tu colección es "categories"
    const url = `${this.API_DIRECTUS_URL}/items/categorias`;
    const params = new HttpParams()
      .set('fields', 'id_categoria,nombre_categoria')
      .set('limit', limit)
      .set('sort', 'name');

    return this.http
      .get<PaginaEjercicios<Categoria>>(url, {
        headers: this.headers(),
        params,
      })
      .pipe(map((r) => r.data));
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
