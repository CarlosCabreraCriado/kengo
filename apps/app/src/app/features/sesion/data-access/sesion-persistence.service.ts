import { Injectable } from '@angular/core';
import { SesionLocal } from '../../../../types/global';

@Injectable({ providedIn: 'root' })
export class SesionPersistenceService {
  private readonly STORAGE_KEY = 'kengo:sesion_activa:v1';
  private readonly TTL_HORAS = 24;

  guardar(data: SesionLocal): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error al guardar progreso local:', error);
    }
  }

  restaurar(): SesionLocal | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;

      const data: SesionLocal = JSON.parse(raw);
      if (this.estaExpirado(data.timestamp)) {
        this.limpiar();
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error al restaurar progreso local:', error);
      this.limpiar();
      return null;
    }
  }

  limpiar(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error al limpiar progreso local:', error);
    }
  }

  private estaExpirado(timestampIso: string): boolean {
    const timestamp = new Date(timestampIso);
    const horasTranscurridas =
      (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
    return horasTranscurridas > this.TTL_HORAS;
  }
}
