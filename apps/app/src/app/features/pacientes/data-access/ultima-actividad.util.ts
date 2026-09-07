import { ymdToDateForDisplay } from '../../../shared/utils/date-tz.util';

/** Última sesión real de un paciente (respuesta de `sessions.queries.getLastActivityByPaciente`). */
export interface UltimaActividad {
  sessionId: string;
  /** YYYY-MM-DD en la TZ del paciente. */
  fecha: string;
  totalCompletados: number;
  /** Días de calendario desde esa sesión hasta hoy (TZ del paciente). */
  diasDesde: number;
}

/** "15 ago" — fecha civil sin pasar por la TZ del dispositivo. */
export function formatFechaCortaYmd(ymd: string): string {
  return ymdToDateForDisplay(ymd).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Texto para el estado vacío de Actividad cuando la ventana visible no tiene
 * sesiones pero el paciente sí tiene historial: "Última sesión el 15 ago
 * (hace 23 días)." Devuelve `null` si no hay última actividad.
 */
export function ultimaActividadLabel(
  ultima: Pick<UltimaActividad, 'fecha' | 'diasDesde'> | null,
): string | null {
  if (!ultima) return null;
  const fecha = formatFechaCortaYmd(ultima.fecha);
  const hace =
    ultima.diasDesde <= 0
      ? 'hoy'
      : ultima.diasDesde === 1
        ? 'ayer'
        : `hace ${ultima.diasDesde} días`;
  return `Última sesión el ${fecha} (${hace}).`;
}
