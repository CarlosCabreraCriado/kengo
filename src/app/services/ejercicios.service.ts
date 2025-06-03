import { Injectable } from '@angular/core';
import { DirectusService } from './directus.service';

import { BehaviorSubject } from 'rxjs';
import { Ejercicio } from '../models/Global';

import { Observable } from 'rxjs';
import { of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class EjerciciosService {
  constructor(private directusService: DirectusService) {}

  public ejercicios$ = new BehaviorSubject<Ejercicio[] | null>(null);

  getEjercicios() {
    if (!this.ejercicios$.value) {
      this.directusService.getEjercicios().subscribe((response) => {
        if (response.data) {
          this.ejercicios$.next(response.data);
        }
      });
    }
  }

  /*
  getEjercicioById(id: number | null): Ejercicio | null {
    console.error(this.ejercicios$.value);
    if (id === null) return null;
    const ejercicios = this.ejercicios$.value;
    if (!ejercicios) return null;
    return (
      ejercicios.find((ejercicio) => ejercicio.id_ejercicio === id) || null
    );
  }
  */

  getEjercicioById(id: number | null): Observable<Ejercicio | null> {
    if (id === null) return of(null);
    return this.ejercicios$.pipe(
      take(1), // solo necesitamos el valor actual
      switchMap((ejercicios) => {
        const ejercicioLocal = ejercicios?.find((e) => e.id_ejercicio === id);
        if (ejercicioLocal) {
          return of(ejercicioLocal);
        } else {
          // fallback: buscar en la API
          return this.directusService.getEjercicioById(id).pipe(
            // podrías agregar lógica para añadirlo a ejercicios$ si quieres
            map((ejercicio) => ejercicio || null),
          );
        }
      }),
    );
  }
}
