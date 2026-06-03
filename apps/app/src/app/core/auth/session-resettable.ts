import { InjectionToken } from '@angular/core';

/**
 * Contrato para servicios singleton que mantienen estado derivado de la
 * sesión del usuario (signals en memoria, entradas en localStorage, etc.).
 *
 * `SessionService.limpiar()` recorre todos los `SessionResettable`
 * registrados al hacer logout y llama a `resetSessionState()` en cada uno,
 * garantizando que ningún rastro del usuario anterior sobrevive al cambio
 * de sesión.
 *
 * La implementación debe ser síncrona e idempotente.
 */
export interface SessionResettable {
  resetSessionState(): void;
}

export const SESSION_RESETTABLES = new InjectionToken<SessionResettable[]>(
  'SESSION_RESETTABLES',
);
