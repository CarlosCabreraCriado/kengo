/**
 * Helpers de fecha/hora centralizados para los nuevos modelos de actividad
 * (sessions rediseñada, exerciseExecutions, rollups).
 *
 * Reglas:
 * - Día de referencia: zona Europe/Madrid (los pacientes y el cron nocturno
 *   se rigen por hora local).
 * - Funciones puras (sin acceso a `ctx`) y deterministas: aceptan `now?: Date`
 *   para facilitar tests.
 *
 * Notas:
 * - Existe una versión simplificada en `convex/compliance/internal.ts`
 *   (`getHoyMadrid`, `getFechaMadridOffset`). Esta nueva implementación
 *   centraliza y amplía. La versión legacy quedará deprecada en Fase 5.
 */

const TZ_MADRID = "Europe/Madrid";

const YMD_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_MADRID,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const HOUR_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ_MADRID,
  hour: "2-digit",
  hour12: false,
});

/**
 * Devuelve la fecha actual (o la pasada) en formato YYYY-MM-DD según el
 * calendario de Europe/Madrid.
 */
export function getCurrentMadridDate(now: Date = new Date()): string {
  return YMD_FORMATTER.format(now);
}

/**
 * Devuelve la fecha YYYY-MM-DD desplazada `offsetDays` días respecto a hoy
 * (Europe/Madrid). Usar offsetDays negativo para fechas pasadas.
 */
export function getMadridDateOffset(
  offsetDays: number,
  now: Date = new Date(),
): string {
  const baseYMD = YMD_FORMATTER.format(now);
  const [y, m, d] = baseYMD.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  return utc.toISOString().slice(0, 10);
}

/**
 * Calcula la hora UTC en la que se debe ejecutar un cron registrado a
 * "23:55 hora Madrid". Devuelve 22 (CET, invierno) o 21 (CEST, verano).
 *
 * NOTA: Convex no permite ajustar el horario de un cron dinámicamente; este
 * helper se mantiene por si se decide rotar el cron a una hora distinta o
 * para tests. El cron real se registra a 22:55 UTC fijo (= 23:55 CET /
 * 00:55 CEST), aceptando un desfase de 1h en los meses de horario de verano.
 */
export function madridCronHourForLocal2355(
  now: Date = new Date(),
): number {
  const madridHour = Number(HOUR_FORMATTER.format(now));
  const utcHour = now.getUTCHours();
  // offset(horas Madrid - UTC). Positivo: Madrid va por delante.
  const offset = (madridHour - utcHour + 24) % 24;
  // 23:55 Madrid = (23 - offset) UTC, normalizado a [0..23].
  return (23 - offset + 24) % 24;
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
