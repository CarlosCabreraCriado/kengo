import {
  getMadridDate,
  offsetMadridDate,
  ymdToDateForDisplay,
} from './madrid-date.util';

/** Variante de formato de fecha disponible en el helper compartido. */
export type FormatDateVariant = 'long' | 'short';

const TZ_MADRID = 'Europe/Madrid';

const SHORT_MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: TZ_MADRID,
  month: 'short',
});
const LONG_MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: TZ_MADRID,
  month: 'long',
});
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: TZ_MADRID,
  weekday: 'short',
});

/**
 * Formatea una fecha YYYY-MM-DD (calendario Europe/Madrid) en español.
 *
 * - `'long'` (por defecto): "Hoy" / "Sáb 27 abril (Ayer)" / "Mar 4 mayo 2027".
 * - `'short'`: "27 abr".
 *
 * "Hoy" y "Ayer" se calculan respecto al calendario Europe/Madrid (mismo
 * huso que el backend), no respecto al huso del navegador.
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

  const hoyYMD = getMadridDate();
  const ayerYMD = offsetMadridDate(-1);

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
