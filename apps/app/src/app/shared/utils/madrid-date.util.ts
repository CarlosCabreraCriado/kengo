/**
 * Helpers de fecha en zona Europe/Madrid para el frontend.
 *
 * El backend (`convex/_helpers/datetime.ts`) define el contrato:
 *   - `fecha` (YYYY-MM-DD) ≡ día del calendario en Europe/Madrid.
 *   - `fechaHora` (ISO string) ≡ instante absoluto UTC.
 *
 * Estas utilidades hacen que el cliente respete ese contrato sin importar
 * la zona horaria del navegador (Canarias, Madrid, viajeros, etc.).
 *
 * Equivalencia 1:1 con el backend: `getMadridDate` ↔ `getCurrentMadridDate`,
 * `diaSemanaFromYMD` ↔ `getDiaSemana`.
 */

import { DiaSemana } from '../../../types/global';

const TZ_MADRID = 'Europe/Madrid';

const YMD_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ_MADRID,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ_MADRID,
  weekday: 'short',
});

const DIAS_LMD: readonly DiaSemana[] = [
  'L',
  'M',
  'X',
  'J',
  'V',
  'S',
  'D',
] as const;

const MAP_EN_TO_DIA: Readonly<Record<string, DiaSemana>> = {
  Mon: 'L',
  Tue: 'M',
  Wed: 'X',
  Thu: 'J',
  Fri: 'V',
  Sat: 'S',
  Sun: 'D',
};

/** Fecha YYYY-MM-DD del instante dado (o ahora) en Europe/Madrid. */
export function getMadridDate(now: Date = new Date()): string {
  return YMD_FORMATTER.format(now);
}

/** Día de la semana ('L'..'D') del instante dado (o ahora) en Europe/Madrid. */
export function getMadridDiaSemana(now: Date = new Date()): DiaSemana {
  return MAP_EN_TO_DIA[WEEKDAY_FORMATTER.format(now)]!;
}

/**
 * Día de la semana de una fecha YYYY-MM-DD interpretada como Madrid.
 * Coincide 1:1 con `getDiaSemana` del backend (`convex/_helpers/datetime.ts`).
 */
export function diaSemanaFromYMD(ymd: string): DiaSemana {
  const [y, m, d] = ymd.split('-').map(Number);
  // 12:00 UTC evita ambigüedades por DST en cualquier zona del cliente.
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  // getUTCDay(): 0=Sun..6=Sat. Lo convertimos a 0=Mon..6=Sun.
  const idx = (date.getUTCDay() + 6) % 7;
  return DIAS_LMD[idx]!;
}

/** Fecha YYYY-MM-DD desplazada `offsetDays` desde hoy (Madrid). */
export function offsetMadridDate(
  offsetDays: number,
  now: Date = new Date(),
): string {
  const [y, m, d] = getMadridDate(now).split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  return utc.toISOString().slice(0, 10);
}

/**
 * Construye un `Date` a partir de YYYY-MM-DD seguro contra DST en cualquier
 * zona del cliente. Útil para extraer día/mes/año de la cadena para mostrar.
 *
 * IMPORTANTE: sobre el `Date` resultante usar siempre `getUTCDate()`,
 * `getUTCMonth()`, `getUTCFullYear()`, NUNCA `getDate()` y compañía.
 */
export function ymdToDateForDisplay(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/**
 * Diferencia en DÍAS calendario entre dos fechas YYYY-MM-DD interpretadas
 * como Madrid. Independiente de DST: cuenta días enteros del calendario,
 * no fracciones de 24 h. Por ejemplo,
 * `daysBetweenYMD('2026-03-29', '2026-03-30')` siempre vale `1` aunque el
 * 29 de marzo en Madrid sólo tenga 23 horas.
 */
export function daysBetweenYMD(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  // 12:00 UTC para esquivar DST en cualquier zona del cliente.
  const a = Date.UTC(y1, m1 - 1, d1, 12);
  const b = Date.UTC(y2, m2 - 1, d2, 12);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Convierte un instante absoluto (ISO 8601, normalmente UTC con `Z` como
 * lo produce `new Date().toISOString()`) en su día calendario
 * Europe/Madrid. Útil para agrupar `exerciseExecutions.fechaHora` por día.
 */
export function ymdMadridFromInstant(iso: string): string {
  return getMadridDate(new Date(iso));
}
