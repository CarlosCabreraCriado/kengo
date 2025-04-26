import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DirectusService {
  private API_DIRECTUS_URL = 'https://admin.kengoapp.com';

  constructor(private http: HttpClient) {}

  getMiUsuario() {
    return this.http.get<{ data: unknown }>(
      `${this.API_DIRECTUS_URL}/users/me`,
    );
  }
}
