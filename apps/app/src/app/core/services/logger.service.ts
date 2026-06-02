import { Injectable, isDevMode } from '@angular/core';

/**
 * Wrapper sobre `console.*` con guard de `isDevMode()`.
 *
 * En producción todas las llamadas son no-op: evita pagar la serialización
 * de objetos a DevTools cuando un usuario abre la consola. En dev mantiene
 * el comportamiento original 1:1 (mismos args, misma signatura por nivel).
 *
 * Uso:
 *   private logger = inject(LoggerService);
 *   this.logger.error('[MiServicio] Error al cargar:', err);
 *
 * Pendiente futuro: cuando se integre Sentry/PostHog (ver
 * `better-auth.service.ts` comentario sobre telemetría) bastará con
 * extender los métodos sin tocar callsites.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly enabled = isDevMode();

  log(...args: unknown[]): void {
    if (this.enabled) console.log(...args);
  }

  warn(...args: unknown[]): void {
    if (this.enabled) console.warn(...args);
  }

  error(...args: unknown[]): void {
    if (this.enabled) console.error(...args);
  }

  info(...args: unknown[]): void {
    if (this.enabled) console.info(...args);
  }

  debug(...args: unknown[]): void {
    if (this.enabled) console.debug(...args);
  }
}
