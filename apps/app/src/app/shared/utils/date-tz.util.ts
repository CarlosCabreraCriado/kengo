/**
 * Helpers de fecha civil (YYYY-MM-DD) parametrizados por zona horaria IANA.
 *
 * Contrato con el backend (`convex/_helpers/datetime.ts` + `patientTz.ts`):
 *   - `fecha` (YYYY-MM-DD) ≡ día del calendario EN LA TZ DEL PACIENTE
 *     (`users.timezone`, fallback Europe/Madrid si nunca sincronizó).
 *   - `fechaHora` (ISO string) ≡ instante absoluto UTC.
 *
 * Qué TZ pasar (regla de la migración TZ):
 *   - Modo paciente: `TimezoneService.deviceTz()` (su propio dispositivo).
 *   - Modo fisio mirando a un paciente: `patient.timezone ?? DEFAULT_TZ_APP`
 *     (el día del PACIENTE, no el del fisio).
 *   - Labels relativos al viewer ("hoy"/"ayer" de listados): deviceTz.
 *
 * Las funciones puras sobre strings YMD (diaSemanaFromYMD, daysBetweenYMD,
 * ymdToDateForDisplay) son TZ-independientes y no reciben tz.
 */

import { DiaSemana } from '../../../types/global';

/** Fallback cuando el paciente aún no tiene TZ sincronizada (contrato backend). */
export const DEFAULT_TZ_APP = 'Europe/Madrid';

/**
 * TZ IANA del dispositivo actual, validada; fallback `Europe/Madrid`.
 * Para código con DI preferir `TimezoneService.deviceTz()` (señal, se
 * re-detecta en cada resume nativo); este helper cubre utils puros.
 */
export function getDeviceTz(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && isValidTzString(tz)) return tz;
  } catch {
    // Entornos sin soporte completo de Intl → fallback.
  }
  return DEFAULT_TZ_APP;
}

function isValidTzString(tz: string): boolean {
  if (tz.length > 64 || !/^[A-Za-z_+\-/0-9]+$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * TZ efectiva de un paciente visto por un tercero (fisio): la persistida en
 * su perfil, o el fallback del contrato si aún no sincronizó.
 */
export function patientTzOf(
  patient: { timezone?: string | null } | null | undefined,
): string {
  const tz = patient?.timezone;
  return tz && isValidTzString(tz) ? tz : DEFAULT_TZ_APP;
}

// Un formatter por TZ (crearlos es caro).
const YMD_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function ymdFormatterFor(tz: string): Intl.DateTimeFormat {
  let fmt = YMD_FORMATTERS.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    YMD_FORMATTERS.set(tz, fmt);
  }
  return fmt;
}

const DIAS_LMD: readonly DiaSemana[] = [
  'L',
  'M',
  'X',
  'J',
  'V',
  'S',
  'D',
] as const;

/** Fecha YYYY-MM-DD del instante dado (o ahora) en la TZ indicada. */
export function getTodayYmd(tz: string, now: Date = new Date()): string {
  return ymdFormatterFor(tz).format(now);
}

/** Día de la semana ('L'..'D') de hoy (o del instante dado) en la TZ indicada. */
export function getDiaSemanaHoy(tz: string, now: Date = new Date()): DiaSemana {
  return diaSemanaFromYMD(getTodayYmd(tz, now));
}

/** Fecha YYYY-MM-DD desplazada `offsetDays` desde hoy en la TZ indicada. */
export function offsetTodayYmd(
  tz: string,
  offsetDays: number,
  now: Date = new Date(),
): string {
  const [y, m, d] = getTodayYmd(tz, now).split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  return utc.toISOString().slice(0, 10);
}

/**
 * Convierte un instante absoluto (ISO 8601, normalmente UTC con `Z` como lo
 * produce `new Date().toISOString()`) en su día calendario en la TZ indicada.
 * Útil para agrupar `exerciseExecutions.fechaHora` por día.
 */
export function ymdFromInstant(iso: string, tz: string): string {
  return getTodayYmd(tz, new Date(iso));
}

/**
 * Día de la semana de una fecha civil YYYY-MM-DD. TZ-independiente.
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

/**
 * Construye un `Date` a partir de YYYY-MM-DD seguro contra DST en cualquier
 * zona del cliente. Útil para extraer día/mes/año de la cadena para mostrar.
 *
 * IMPORTANTE: sobre el `Date` resultante usar siempre `getUTCDate()`,
 * `getUTCMonth()`, `getUTCFullYear()` — NUNCA `getDate()` y compañía — y en
 * `toLocaleDateString`/`Intl` pasar siempre `timeZone: 'UTC'`.
 */
export function ymdToDateForDisplay(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/**
 * Desplaza una fecha civil YYYY-MM-DD en `offsetDays` días. TZ-independiente
 * (aritmética pura de calendario, robusta ante DST).
 */
export function addDaysYmd(ymd: string, offsetDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  return utc.toISOString().slice(0, 10);
}

/**
 * Diferencia en DÍAS calendario entre dos fechas civiles YYYY-MM-DD.
 * TZ-independiente y robusto ante DST (cuenta días enteros del calendario,
 * no fracciones de 24 h).
 */
export function daysBetweenYMD(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  // 12:00 UTC para esquivar DST en cualquier zona del cliente.
  const a = Date.UTC(y1, m1 - 1, d1, 12);
  const b = Date.UTC(y2, m2 - 1, d2, 12);
  return Math.round((b - a) / 86_400_000);
}
