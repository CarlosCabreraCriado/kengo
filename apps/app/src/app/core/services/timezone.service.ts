import { inject, Injectable, signal } from '@angular/core';
import { api } from '../../../../../../convex/_generated/api';
import { getDeviceTz } from '../../shared/utils/date-tz.util';
import { ConvexService } from '../convex/convex.service';
import { LoggerService } from './logger.service';

/**
 * Zona horaria del dispositivo del usuario.
 *
 * El "día" de un paciente (sessions, executions, rollups, racha) se define
 * por su TZ IANA persistida en `users.timezone` (backend). Este servicio:
 *  - Detecta la TZ del dispositivo (`Intl.resolvedOptions().timeZone`).
 *  - La sincroniza al backend (`users.syncTimezone`) tras cargar el usuario
 *    y en cada resume nativo si cambió (viajes, cambio de ajustes).
 *
 * El backend deriva la fecha de cada escritura por su cuenta con la TZ
 * persistida — la sincronización solo mantiene ese dato fresco.
 */
@Injectable({ providedIn: 'root' })
export class TimezoneService {
  private readonly convex = inject(ConvexService);
  private readonly logger = inject(LoggerService);

  private readonly _deviceTz = signal<string>(getDeviceTz());
  /** TZ IANA del dispositivo, validada; fallback `Europe/Madrid`. */
  readonly deviceTz = this._deviceTz.asReadonly();

  /** Última TZ aceptada por el backend en esta sesión (evita re-syncs). */
  private lastSyncedTz: string | null = null;

  /**
   * Re-detecta la TZ (puede haber cambiado con la app en background) y la
   * sincroniza al backend si es distinta de la última enviada. Best-effort:
   * nunca lanza (no debe romper el arranque ni el resume).
   */
  async syncWithBackend(): Promise<void> {
    const tz = getDeviceTz();
    this._deviceTz.set(tz);
    if (tz === this.lastSyncedTz) return;

    try {
      const result = await this.convex.mutation(
        api.users.mutations.syncTimezone,
        { timezone: tz },
      );
      if (result?.accepted) {
        this.lastSyncedTz = tz;
      } else {
        this.logger.warn(`[Timezone] backend rechazó la TZ: ${tz}`);
      }
    } catch (err) {
      this.logger.warn('[Timezone] sync falló (se reintentará):', err);
    }
  }
}
