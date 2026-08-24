/**
 * Helpers de fecha/hora centralizados para los nuevos modelos de actividad
 * (sessions rediseñada, exerciseExecutions, rollups).
 *
 * Reglas:
 * - Día de referencia: la zona horaria IANA del paciente (`users.timezone`),
 *   con fallback `DEFAULT_TZ` (Europe/Madrid) cuando aún no está sincronizada.
 *   La resolución de la TZ desde BD vive en `_helpers/patientTz.ts`.
 * - Los agregados de clínica (dashboard, exerciseUsageRollup) siguen usando
 *   Madrid como TZ de referencia única — decisión documentada en cada caller.
 * - Funciones puras (sin acceso a `ctx`) y deterministas: aceptan `now?: Date`
 *   para facilitar tests.
 */

export const DEFAULT_TZ = "Europe/Madrid";

/**
 * TZ de referencia para agregados a nivel CLÍNICA (dashboard, snapshots de
 * clínica, exerciseUsageRollup): mezclan pacientes de varias TZ, así que se
 * fija una única referencia. Alias intencional — no confundir con el fallback
 * de pacientes sin TZ (`DEFAULT_TZ`), que coincide en valor pero no en rol.
 */
export const CLINIC_REF_TZ = DEFAULT_TZ;

// Un formatter por TZ (crearlos es caro; antes era un singleton Madrid).
const YMD_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function ymdFormatterFor(tz: string): Intl.DateTimeFormat {
  let fmt = YMD_FORMATTERS.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    YMD_FORMATTERS.set(tz, fmt);
  }
  return fmt;
}

/**
 * Valida un identificador de zona horaria IANA (p.ej. "Atlantic/Canary").
 * El patrón previo evita pasar basura arbitraria a `Intl` (que lanza) y
 * el try/catch descarta nombres con formato plausible pero inexistentes.
 */
export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || tz.length > 64 || !/^[A-Za-z_+\-/0-9]+$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Devuelve la fecha actual (o la pasada) en formato YYYY-MM-DD según el
 * calendario de la zona horaria `tz`.
 */
export function getCurrentDateInTz(tz: string, now: Date = new Date()): string {
  return ymdFormatterFor(tz).format(now);
}

/**
 * Devuelve la fecha YYYY-MM-DD desplazada `offsetDays` días respecto a hoy
 * en la zona `tz`. Usar offsetDays negativo para fechas pasadas.
 */
export function getDateOffsetInTz(
  tz: string,
  offsetDays: number,
  now: Date = new Date(),
): string {
  return addDaysToYMD(getCurrentDateInTz(tz, now), offsetDays);
}

/**
 * ¿Debe el cron nocturno cerrar una sesión abierta con esta `fecha`?
 * Solo cuando el día de la sesión ya terminó en la TZ de SU paciente —
 * a las 02:00 UTC el día aún está en curso para TZs por detrás de Madrid
 * (Canarias, América), y cerrar ahí truncaría el día del paciente.
 */
export function shouldCloseSession(
  fechaSesion: string,
  tz: string,
  now: Date = new Date(),
): boolean {
  return fechaSesion < getCurrentDateInTz(tz, now);
}

/**
 * @deprecated Usar `getCurrentDateInTz(tz)` con la TZ del paciente
 * (`_helpers/patientTz.ts`). Solo válido donde Madrid es la TZ de referencia
 * intencional (agregados de clínica).
 */
export function getCurrentMadridDate(now: Date = new Date()): string {
  return getCurrentDateInTz(DEFAULT_TZ, now);
}

/**
 * @deprecated Usar `getDateOffsetInTz(tz, offsetDays)` con la TZ del paciente.
 */
export function getMadridDateOffset(
  offsetDays: number,
  now: Date = new Date(),
): string {
  return getDateOffsetInTz(DEFAULT_TZ, offsetDays, now);
}

/**
 * Diferencia en días de calendario entre dos fechas YYYY-MM-DD (hasta - desde).
 * Independiente de TZ (opera en UTC sobre la fecha civil). Positivo cuando
 * `hastaYMD` es posterior a `desdeYMD`.
 */
export function diffDaysYMD(desdeYMD: string, hastaYMD: string): number {
  const [y1, m1, d1] = desdeYMD.split("-").map(Number);
  const [y2, m2, d2] = hastaYMD.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

/**
 * Desplaza una fecha YYYY-MM-DD en `offsetDays` días (independiente de TZ).
 * Usar offsetDays negativo para retroceder. Devuelve YYYY-MM-DD.
 */
export function addDaysToYMD(fechaYMD: string, offsetDays: number): string {
  const [y, m, d] = fechaYMD.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  return utc.toISOString().slice(0, 10);
}

/**
 * Convierte una fecha YYYY-MM-DD en su semana ISO 8601 ("YYYY-Www").
 * Reglas ISO: lunes = primer día de la semana; la primera semana del año
 * es la que contiene el primer jueves (equivalente: contiene el 4 de enero).
 */
export function anioSemanaISO(fechaYMD: string): string {
  const [y, m, d] = fechaYMD.split("-").map(Number);
  // Trabajamos en UTC para evitar TZ shifts; las fechas YYYY-MM-DD son
  // independientes de TZ.
  const date = new Date(Date.UTC(y, m - 1, d));
  // Día de la semana (1=lun ... 7=dom).
  const dayNum = date.getUTCDay() || 7;
  // Mover al jueves de la misma semana ISO.
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  // Inicio del año (1 de enero) en UTC.
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNum = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  const ww = String(weekNum).padStart(2, "0");
  return `${isoYear}-W${ww}`;
}

/** Convierte una fecha YYYY-MM-DD en su año-mes ("YYYY-MM"). */
export function anioMes(fechaYMD: string): string {
  return fechaYMD.slice(0, 7);
}

/** Devuelve el lunes (YYYY-MM-DD) de una semana ISO "YYYY-Www". */
export function startOfISOWeek(anioSemana: string): string {
  const [yStr, wStr] = anioSemana.split("-W");
  const isoYear = Number(yStr);
  const week = Number(wStr);
  // 4 de enero siempre cae en la semana 1 ISO.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 1..7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return target.toISOString().slice(0, 10);
}

/** Devuelve el domingo (YYYY-MM-DD) de una semana ISO "YYYY-Www". */
export function endOfISOWeek(anioSemana: string): string {
  const monday = startOfISOWeek(anioSemana);
  const [y, m, d] = monday.split("-").map(Number);
  const sunday = new Date(Date.UTC(y, m - 1, d));
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return sunday.toISOString().slice(0, 10);
}

/** Devuelve el primer día (YYYY-MM-DD) de un mes "YYYY-MM". */
export function startOfMonth(anioMesStr: string): string {
  return `${anioMesStr}-01`;
}

/** Devuelve el último día (YYYY-MM-DD) de un mes "YYYY-MM". */
export function endOfMonth(anioMesStr: string): string {
  const [y, m] = anioMesStr.split("-").map(Number);
  // Día 0 del mes siguiente = último día del mes solicitado.
  const last = new Date(Date.UTC(y, m, 0));
  return last.toISOString().slice(0, 10);
}

export type DiaSemana = "L" | "M" | "X" | "J" | "V" | "S" | "D";
const DIAS_SEMANA: DiaSemana[] = ["D", "L", "M", "X", "J", "V", "S"];

/** Devuelve el día de la semana (L..D) de una fecha YYYY-MM-DD. */
export function getDiaSemana(fechaYMD: string): DiaSemana {
  const [y, m, d] = fechaYMD.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return DIAS_SEMANA[date.getUTCDay()];
}

/**
 * Devuelve un array de fechas YYYY-MM-DD entre `desde` y `hasta`, ambos
 * inclusive. Útil para iterar rollups diarios al recomputar semana/mes.
 */
export function rangeOfDates(desdeYMD: string, hastaYMD: string): string[] {
  const out: string[] = [];
  const [y1, m1, d1] = desdeYMD.split("-").map(Number);
  const [y2, m2, d2] = hastaYMD.split("-").map(Number);
  const start = new Date(Date.UTC(y1, m1 - 1, d1));
  const end = new Date(Date.UTC(y2, m2 - 1, d2));
  for (
    let cur = new Date(start);
    cur <= end;
    cur.setUTCDate(cur.getUTCDate() + 1)
  ) {
    out.push(cur.toISOString().slice(0, 10));
  }
  return out;
}
