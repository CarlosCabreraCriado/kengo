import { Injectable } from '@angular/core';
import { SesionHintUI } from '../../../../types/global';

/**
 * Persistencia ligera de la posición de UI dentro de la sesión activa.
 *
 * Tras el rediseño Convex donde `sessions` y `exerciseExecutions` son
 * fuente de verdad, este servicio solo guarda un *hint* efímero
 * (ejercicioIndex, serieActual, estadoPantalla, sessionId) para que el
 * paciente reanude la sesión exactamente donde la dejó tras recargar la
 * pestaña. Ningún dato clínico vive aquí: se persisten en Convex al
 * instante.
 *
 * Si el hint caduca, no existe, o pertenece a una sesión distinta a la
 * `en_curso` actual, el cliente reconstruye la posición desde Convex
 * (primer ejercicio sin execution completada).
 */
@Injectable({ providedIn: 'root' })
export class SesionPersistenceService {
  private readonly STORAGE_KEY = 'kengo:sesion_activa:v2';
  private readonly LEGACY_STORAGE_KEY = 'kengo:sesion_activa:v1';
  private readonly TTL_HORAS = 4;

  constructor() {
    this.eliminarLegacy();
  }

  guardarHint(hint: SesionHintUI): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(hint));
    } catch (error) {
      console.error('Error al guardar hint de sesión:', error);
    }
  }

  /**
   * Devuelve el hint válido (no expirado) o null. Si el hint pertenece a
   * una sesión distinta a `expectedSessionId`, también devuelve null y
   * limpia la entrada para evitar arrastrar estado de una sesión vieja.
   */
  restaurarHint(expectedSessionId?: string): SesionHintUI | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;

      const hint: SesionHintUI = JSON.parse(raw);
      if (this.estaExpirado(hint.timestamp)) {
        this.limpiar();
        return null;
      }
      if (expectedSessionId && hint.sessionId !== expectedSessionId) {
        this.limpiar();
        return null;
      }
      return hint;
    } catch (error) {
      console.error('Error al restaurar hint de sesión:', error);
      this.limpiar();
      return null;
    }
  }

  limpiar(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error al limpiar hint de sesión:', error);
    }
  }

  /**
   * Borra silenciosamente cualquier resto del formato legacy v1. Los
   * registros pendientes que pudiera contener se pierden, pero solo
   * afecta a sesiones que estaban a mitad en el momento del deploy.
   */
  private eliminarLegacy(): void {
    try {
      if (localStorage.getItem(this.LEGACY_STORAGE_KEY)) {
        localStorage.removeItem(this.LEGACY_STORAGE_KEY);
        console.warn(
          '[SesionPersistenceService] borrador legacy v1 descartado tras migración a v2',
        );
      }
    } catch {
      // localStorage puede fallar en modo privado; ignorar.
    }
  }

  private estaExpirado(timestampIso: string): boolean {
    const timestamp = new Date(timestampIso);
    const horasTranscurridas =
      (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
    return horasTranscurridas > this.TTL_HORAS;
  }
}
