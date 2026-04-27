/**
 * Cálculos puros para rollups y agregados de sesión.
 *
 * Estas funciones NO acceden a `ctx.db`: solo operan sobre datos ya cargados.
 * Esto permite testearlas en aislamiento y reutilizarlas tanto en escritura
 * (mutations) como en backfill (migrations).
 */

export type EstadoDia =
  | "completado"
  | "parcial"
  | "fallido"
  | "descanso"
  | "sin_plan";

/**
 * Determina el estado del día a partir de los conteos.
 *
 * Reglas:
 * - "sin_plan": el paciente no tiene plan activo ese día.
 * - "descanso": tiene plan, pero no se esperan ejercicios (día de descanso).
 * - "completado": esperados > 0 y completados >= esperados.
 * - "parcial": 0 < completados < esperados.
 * - "fallido": esperados > 0 y completados == 0.
 */
export function computeEstadoDia(
  esperados: number,
  completados: number,
  hayPlan: boolean,
): EstadoDia {
  if (!hayPlan) return "sin_plan";
  if (esperados === 0) return "descanso";
  if (completados >= esperados) return "completado";
  if (completados === 0) return "fallido";
  return "parcial";
}

/**
 * Calcula la adherencia (%) sobre días con plan activo.
 *
 * Definición: (diasCompletados + 0.5*diasParciales) / diasConPlanNoDescanso
 * Devuelve 0 si no hay días con plan no-descanso.
 */
export function computeAdherencia(
  diasCompletados: number,
  diasParciales: number,
  diasConPlanNoDescanso: number,
): number {
  if (diasConPlanNoDescanso <= 0) return 0;
  const score = diasCompletados + 0.5 * diasParciales;
  return Math.round((score / diasConPlanNoDescanso) * 100);
}

/**
 * Calcula la racha máxima de días "completado" consecutivos en una serie.
 * Los estados "descanso" no rompen la racha (se saltan, no suman ni cortan).
 * Otros estados ("parcial", "fallido", "sin_plan") sí cortan.
 */
export function computeRachaMaxima(estadosDia: EstadoDia[]): number {
  let max = 0;
  let cur = 0;
  for (const e of estadosDia) {
    if (e === "completado") {
      cur += 1;
      if (cur > max) max = cur;
    } else if (e === "descanso") {
      // no toca racha
    } else {
      cur = 0;
    }
  }
  return max;
}

/**
 * Racha actual de días "completado" terminando en el último elemento de la
 * lista. Útil para `rachaActual` de los snapshots.
 */
export function computeRachaActual(estadosDia: EstadoDia[]): number {
  let cur = 0;
  for (let i = estadosDia.length - 1; i >= 0; i--) {
    const e = estadosDia[i];
    if (e === "completado") cur += 1;
    else if (e === "descanso") continue;
    else break;
  }
  return cur;
}

export interface ExecutionAggregateInput {
  completado: boolean;
  dolorEscala?: number;
  esfuerzoEscala?: number;
  duracionRealSeg?: number;
}

export interface SessionAggregates {
  totalCompletados: number;
  duracionTotalSeg?: number;
  dolorMin?: number;
  dolorMax?: number;
  dolorPromedio?: number;
  esfuerzoPromedio?: number;
}

/**
 * Calcula los agregados de una sesión a partir de sus ejecuciones.
 * Los campos opcionales se omiten si no hay datos para calcularlos
 * (ninguna ejecución reportó dolor/esfuerzo/duración).
 */
export function computeAggregatesFromExecutions(
  executions: ExecutionAggregateInput[],
): SessionAggregates {
  const result: SessionAggregates = {
    totalCompletados: 0,
  };

  let dolorSum = 0;
  let dolorCount = 0;
  let dolorMin: number | undefined;
  let dolorMax: number | undefined;

  let esfuerzoSum = 0;
  let esfuerzoCount = 0;

  let duracionSum = 0;
  let duracionCount = 0;

  for (const ex of executions) {
    if (ex.completado) result.totalCompletados += 1;
    if (ex.dolorEscala !== undefined) {
      dolorSum += ex.dolorEscala;
      dolorCount += 1;
      if (dolorMin === undefined || ex.dolorEscala < dolorMin) {
        dolorMin = ex.dolorEscala;
      }
      if (dolorMax === undefined || ex.dolorEscala > dolorMax) {
        dolorMax = ex.dolorEscala;
      }
    }
    if (ex.esfuerzoEscala !== undefined) {
      esfuerzoSum += ex.esfuerzoEscala;
      esfuerzoCount += 1;
    }
    if (ex.duracionRealSeg !== undefined) {
      duracionSum += ex.duracionRealSeg;
      duracionCount += 1;
    }
  }

  if (dolorCount > 0) {
    result.dolorMin = dolorMin;
    result.dolorMax = dolorMax;
    result.dolorPromedio = round2(dolorSum / dolorCount);
  }
  if (esfuerzoCount > 0) {
    result.esfuerzoPromedio = round2(esfuerzoSum / esfuerzoCount);
  }
  if (duracionCount > 0) {
    result.duracionTotalSeg = duracionSum;
  }

  return result;
}

/**
 * Calcula el riskScore (0-100) de un paciente combinando inactividad y
 * adherencia. Mayor score = mayor riesgo.
 *
 * Heurística (validar/ajustar con producto antes de Fase 4):
 * - inactividadDias: 0..14+ → 0..50 puntos (lineal, capa a 14d).
 * - adherencia 100..0 → 0..40 puntos (lineal invertida).
 * - tendenciaAdherencia (delta vs mes anterior): cada -10pp suma 10 (cap a 10).
 */
export function computeRiskScore(input: {
  inactividadDias: number;
  adherencia: number;
  tendenciaAdherencia?: number;
}): number {
  const inact = Math.min(input.inactividadDias, 14);
  const inactScore = (inact / 14) * 50;
  const adhScore = ((100 - clamp(input.adherencia, 0, 100)) / 100) * 40;
  const tend = input.tendenciaAdherencia ?? 0;
  const tendScore = tend < 0 ? Math.min(Math.abs(tend), 10) : 0;
  return Math.round(inactScore + adhScore + tendScore);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
