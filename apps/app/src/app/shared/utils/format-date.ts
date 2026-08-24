import {
  getDeviceTz,
  getTodayYmd,
  offsetTodayYmd,
  ymdToDateForDisplay,
} from './date-tz.util';

/** Variante de formato de fecha disponible en el helper compartido. */
export type FormatDateVariant = 'long' | 'short';

// Los formatters extraen etiquetas (mes, día de semana) de un Date anclado a
// 12:00 UTC (`ymdToDateForDisplay`), así que la TZ correcta es UTC: es una
// fecha CIVIL, no un instante — ninguna TZ del dispositivo debe desplazarla.
const SHORT_MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  month: 'short',
});
const LONG_MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  month: 'long',
});
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  weekday: 'short',
});

/**
 * Formatea una fecha civil YYYY-MM-DD en español.
 *
 * - `'long'` (por defecto): "Hoy" / "Sáb 27 abril (Ayer)" / "Mar 4 mayo 2027".
 * - `'short'`: "27 abr".
 *
 * "Hoy" y "Ayer" son relativos al VIEWER: se calculan con la TZ del
 * dispositivo de quien mira (un canario a las 23:30 sigue viendo "Hoy" en su
 * día local).
 */
export function formatDate(
  iso: string,
  variant: FormatDateVariant = 'long',
): string {
  const d = ymdToDateForDisplay(iso);

  if (variant === 'short') {
    const day = d.getUTCDate();
    const month = SHORT_MONTH_FORMATTER.format(d);
    return `${day} ${month}`;
  }

  const tz = getDeviceTz();
  const hoyYMD = getTodayYmd(tz);
  const ayerYMD = offsetTodayYmd(tz, -1);

  if (iso === hoyYMD) return 'Hoy';
  const esAyer = iso === ayerYMD;

  const weekday = WEEKDAY_FORMATTER.format(d);
  const day = d.getUTCDate();
  const month = LONG_MONTH_FORMATTER.format(d);
  const hoyDate = ymdToDateForDisplay(hoyYMD);
  const year =
    d.getUTCFullYear() !== hoyDate.getUTCFullYear()
      ? ` ${d.getUTCFullYear()}`
      : '';
  const label = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day} ${month}${year}`;
  return esAyer ? `${label} (Ayer)` : label;
}
