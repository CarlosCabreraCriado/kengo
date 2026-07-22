/**
 * Tipos y lógica pura de calendario para `ui2-datepicker`.
 *
 * Toda la aritmética de fechas trabaja con strings 'yyyy-mm-dd' y `Date`
 * anclados a las 12:00 UTC (patrón de `madrid-date.util.ts`), usando SIEMPRE
 * `getUTC*`. Nunca `new Date('yyyy-mm-dd')` naive (interpretaría medianoche UTC
 * y desplazaría el día en zonas negativas). Las comparaciones de rango se hacen
 * por orden lexicográfico de 'yyyy-mm-dd', que es TZ-safe.
 */

export type Ui2DatepickerMode = 'date' | 'datetime' | 'time';

/** Datos que el trigger pasa al sheet vía `DIALOG_DATA`. */
export interface Ui2DatepickerSheetData {
  value: string | null;
  min: string | null;
  max: string | null;
  mode: Ui2DatepickerMode;
}

/** Una celda del calendario mensual. */
export interface Ui2DatepickerDay {
  ymd: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  disabled: boolean;
}

export const MESES_ES: readonly string[] = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

/** Iniciales de día de la semana, empezando en lunes (coincide con DIAS_LMD). */
export const WEEKDAYS_LMD: readonly string[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** 'yyyy-mm-dd' de un `Date` usando SIEMPRE getUTC* (Date anclado a 12:00 UTC). */
function ymdFromUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Nº de días del mes (`m`: 1-12). */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
}

/** Índice de día de semana (lunes=0 … domingo=6) del día 1 del mes. */
function mondayIndexOfFirst(y: number, m: number): number {
  const first = new Date(Date.UTC(y, m - 1, 1, 12));
  return (first.getUTCDay() + 6) % 7;
}

/** Suma `delta` meses a `{ y, m }` (`m`: 1-12), normalizando el año. */
export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const total = y * 12 + (m - 1) + delta;
  return { y: Math.floor(total / 12), m: (total % 12) + 1 };
}

/** `{ y, m }` (`m`: 1-12) de un 'yyyy-mm-dd'. */
export function monthOf(ymd: string): { y: number; m: number } {
  const [y, m] = ymd.split('-').map(Number);
  return { y, m };
}

/** Etiqueta "julio 2026" del mes dado. */
export function monthLabel(y: number, m: number): string {
  return `${MESES_ES[m - 1]} ${y}`;
}

/**
 * Matriz de semanas (cada una 7 celdas, lunes→domingo) que cubre el mes `m`
 * (1-12) del año `y`, incluyendo días de relleno de los meses vecinos.
 */
export function buildMonthGrid(
  y: number,
  m: number,
  ctx: { value: string | null; min: string | null; max: string | null; today: string },
): Ui2DatepickerDay[][] {
  const offset = mondayIndexOfFirst(y, m);
  const total = daysInMonth(y, m);
  const cellCount = Math.ceil((offset + total) / 7) * 7;

  // Primer día visible = lunes en/antes del día 1 del mes.
  const cursor = new Date(Date.UTC(y, m - 1, 1, 12));
  cursor.setUTCDate(cursor.getUTCDate() - offset);

  const weeks: Ui2DatepickerDay[][] = [];
  for (let i = 0; i < cellCount; i++) {
    if (i % 7 === 0) weeks.push([]);
    const ymd = ymdFromUtc(cursor);
    const isSelected = !!ctx.value && ymd === ctx.value;
    weeks[weeks.length - 1].push({
      ymd,
      day: cursor.getUTCDate(),
      inMonth: cursor.getUTCMonth() === m - 1,
      isToday: ymd === ctx.today,
      isSelected,
      // La fecha ya seleccionada nunca se deshabilita: en edición un plan puede
      // tener una fecha anterior a `min` (hoy) y debe poder re-seleccionarse.
      disabled: isSelected
        ? false
        : (!!ctx.min && ymd < ctx.min) || (!!ctx.max && ymd > ctx.max),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return weeks;
}
