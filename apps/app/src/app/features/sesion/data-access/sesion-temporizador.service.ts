import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SesionTemporizadorService {
  readonly tiempoRestante = signal<number>(0);
  readonly temporizadorActivo = signal<boolean>(false);
  readonly descansoEntreEjercicios = signal<boolean>(false);

  iniciarDescanso(segundos: number, esEntreEjercicios: boolean): void {
    this.descansoEntreEjercicios.set(esEntreEjercicios);
    this.tiempoRestante.set(segundos);
    this.temporizadorActivo.set(true);
  }

  agregarTiempo(segundos: number): void {
    this.tiempoRestante.update((t) => t + segundos);
  }

  detener(): void {
    this.temporizadorActivo.set(false);
  }

  reset(): void {
    this.tiempoRestante.set(0);
    this.temporizadorActivo.set(false);
    this.descansoEntreEjercicios.set(false);
  }
}
