import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

//RXJS:
import { BehaviorSubject } from 'rxjs';

//Modelos:
import { Usuario, DetalleUsuario, Accesos } from '../models/Global';

@Injectable({ providedIn: 'root' })
export class AppService {
  private API_DIRECTUS_URL = 'https://admin.kengoapp.com';

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  usuario$ = new BehaviorSubject<Usuario | null | undefined>(undefined);
  misDetalles$ = new BehaviorSubject<Usuario | null | undefined>(undefined);
  accesos$ = new BehaviorSubject<Accesos | null | undefined>(undefined);

  inicializarApp() {
    console.warn('Inicializando app');
    this.cargarMiUsuario();
  }

  cargarMiUsuario() {
    this.http
      .get<{ data: Usuario }>(`${this.API_DIRECTUS_URL}/users/me`)
      .subscribe({
        next: (res) => {
          this.usuario$.next({
            id: res.data['id'],
            avatar: res.data['avatar'],
            first_name: res.data['first_name'],
            last_name: res.data['last_name'],
            email: res.data['email'],
            detalle: null,
          });
          console.warn('Usuario: ', this.usuario$.value);
        },
        error: (error) => {
          console.error('Error al cargar el usuario:', error);
          this.router.navigate(['/login']);
        },
      });
  }

  cargarMiDetalle() {
    if (!this.usuario$.value || !this.usuario$.value?.id) {
      console.error('No se ha cargado el usuario');
      return;
    }

    this.http
      .get<{
        data: DetalleUsuario[];
      }>(
        `https://admin.kengoapp.com/items/detalle_usuario?filter[id_usuario][_eq]=${this.usuario$.value.id}`,
      )
      .subscribe({
        next: (res) => {
          if (this.usuario$.value) {
            this.usuario$.next({
              ...this.usuario$.value,
              detalle: res.data[0],
            });
          }
          console.warn('Usuario+detalle: ', this.usuario$.value);
        },
        error: (error) => {
          console.error('Error al cargar el detalle del usuario', error);
        },
      });
  }
}
