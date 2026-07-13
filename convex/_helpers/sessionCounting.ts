/**
 * Conteo canónico de una sesión/día por IDENTIDAD de ejercicio.
 *
 * Función pura (sin `ctx.db`), compartida por:
 *   - `sessions/internal.recomputeAggregatesAndCheckAutoCloseImpl` y `closeImpl`
 *   - `rollups/internal.upsertDailyForClinic`
 *   - `sessions/queries.getDayDetailByPaciente`
 *   - `migrations/repairSessionsIntegrity`
 *
 * Semántica:
 *   - `totalCompletados` = nº de planExercises ESPERADOS del día con ≥1
 *     ejecución completada (dedup por planExerciseId). Nunca supera
 *     `totalEsperados`.
 *   - `totalExtras` = grupos dedup completados que no corresponden a ningún
 *     esperado del día (ejercicio no programado hoy, plan de otra clínica,
 *     o versión de plan cuya prescripción ya no existe). Los extras no
 *     cuentan para la completitud.
 *
 * Matching en 3 pasadas deterministas (máx. 1 ejecución por esperado y
 * 1 esperado por ejecución):
 *   1. Identidad exacta por `planExerciseId`.
 *   2. Mismo `exerciseId` de catálogo dentro de la misma cadena de versiones
 *      (`canonicalPlanId` coincide). Absorbe la historia reescrita por
 *      versionados retroactivos: la ejecución apunta al planExercise de la
 *      versión vieja pero es el mismo ejercicio prescrito.
 *   3. Mismo `exerciseId` global (cruza familias de planes).
 */

import { Id } from "../_generated/dataModel";

export interface ExpectedSlot {
  planExerciseId: Id<"planExercises">;
  planId: Id<"plans">;
  exerciseId: Id<"exercises">;
  /** resolveCanonicalPlanId(planId) — necesario para la pasada 2. */
  canonicalPlanId?: Id<"plans">;
}

export interface ExecutionForCount {
  executionId: Id<"exerciseExecutions">;
  planExerciseId: Id<"planExercises">;
  planId: Id<"plans">;
  completado: boolean;
  fechaHora: string;
  /** exerciseId del planExercise referenciado; undefined si fue borrado. */
  exerciseId?: Id<"exercises">;
  /** resolveCanonicalPlanId(planId) — pasada 2 y atribución de extras. */
  canonicalPlanId?: Id<"plans">;
  dolorEscala?: number;
  esfuerzoEscala?: number;
  duracionRealSeg?: number;
  repeticionesRealizadas?: number;
  notaPaciente?: string;
}

export interface PlanDayCounts {
  esperados: number;
  completados: number;
  extras: number;
}

export interface DayCounts {
  totalEsperados: number;
  totalCompletados: number;
  totalExtras: number;
  /**
   * Esperados/completados atribuidos al plan del esperado (propiedad del
   * planExercise en la versión vigente ese día). Extras atribuidos al plan
   * canónico de la ejecución (entrada con esperados=0 si no estaba vigente).
   */
  porPlan: Map<Id<"plans">, PlanDayCounts>;
  /** esperado → ejecución representante que lo satisface. */
  matchedByExpected: Map<Id<"planExercises">, ExecutionForCount>;
  /** Representantes dedup completados sin esperado que los reclame. */
  extras: ExecutionForCount[];
  /** 1 representante por planExerciseId (para agregados dolor/esfuerzo/duración). */
  dedupExecutions: ExecutionForCount[];
}

function tieneFeedback(e: ExecutionForCount): boolean {
  return (
    e.dolorEscala !== undefined ||
    e.esfuerzoEscala !== undefined ||
    (e.notaPaciente !== undefined && e.notaPaciente.trim().length > 0)
  );
}

/**
 * Representante de un grupo de ejecuciones del mismo planExercise:
 * completada > no completada; con feedback > sin feedback; fechaHora mayor.
 * Así una repetición fantasma sin feedback no eclipsa a la fila que lleva
 * la nota/dolor que el fisio ya vio.
 */
function pickRepresentative(group: ExecutionForCount[]): ExecutionForCount {
  let best = group[0];
  for (let i = 1; i < group.length; i++) {
    const cand = group[i];
    if (cand.completado !== best.completado) {
      if (cand.completado) best = cand;
      continue;
    }
    const candFb = tieneFeedback(cand);
    const bestFb = tieneFeedback(best);
    if (candFb !== bestFb) {
      if (candFb) best = cand;
      continue;
    }
    if (cand.fechaHora > best.fechaHora) best = cand;
  }
  return best;
}

export function computeDayCounts(
  expected: ExpectedSlot[],
  executions: ExecutionForCount[],
): DayCounts {
  // 1. Dedup por planExerciseId.
  const groups = new Map<Id<"planExercises">, ExecutionForCount[]>();
  for (const e of executions) {
    const g = groups.get(e.planExerciseId);
    if (g) g.push(e);
    else groups.set(e.planExerciseId, [e]);
  }
  const dedupExecutions: ExecutionForCount[] = [];
  for (const g of groups.values()) dedupExecutions.push(pickRepresentative(g));
  // Orden estable por fechaHora (asc) para matching determinista.
  dedupExecutions.sort((a, b) =>
    a.fechaHora < b.fechaHora ? -1 : a.fechaHora > b.fechaHora ? 1 : 0,
  );

  const candidatas = dedupExecutions.filter((e) => e.completado);

  // 2-4. Matching en 3 pasadas. `slotConsumed` por índice del esperado.
  const slotConsumed = new Array<boolean>(expected.length).fill(false);
  const candidateConsumed = new Array<boolean>(candidatas.length).fill(false);
  const matchedByExpected = new Map<Id<"planExercises">, ExecutionForCount>();

  const matchPass = (
    matches: (c: ExecutionForCount, s: ExpectedSlot) => boolean,
  ) => {
    for (let ci = 0; ci < candidatas.length; ci++) {
      if (candidateConsumed[ci]) continue;
      const c = candidatas[ci];
      for (let si = 0; si < expected.length; si++) {
        if (slotConsumed[si]) continue;
        const s = expected[si];
        if (matches(c, s)) {
          slotConsumed[si] = true;
          candidateConsumed[ci] = true;
          matchedByExpected.set(s.planExerciseId, c);
          break;
        }
      }
    }
  };

  // Pasada 1: identidad exacta.
  matchPass((c, s) => c.planExerciseId === s.planExerciseId);
  // Pasada 2: mismo ejercicio de catálogo dentro de la misma cadena de versiones.
  matchPass(
    (c, s) =>
      c.exerciseId !== undefined &&
      c.exerciseId === s.exerciseId &&
      c.canonicalPlanId !== undefined &&
      s.canonicalPlanId !== undefined &&
      c.canonicalPlanId === s.canonicalPlanId,
  );
  // Pasada 3: mismo ejercicio de catálogo, sin restricción de plan.
  matchPass((c, s) => c.exerciseId !== undefined && c.exerciseId === s.exerciseId);

  const extras = candidatas.filter((_, i) => !candidateConsumed[i]);

  // 5. Conteos por plan.
  const porPlan = new Map<Id<"plans">, PlanDayCounts>();
  const bucket = (planId: Id<"plans">): PlanDayCounts => {
    let b = porPlan.get(planId);
    if (!b) {
      b = { esperados: 0, completados: 0, extras: 0 };
      porPlan.set(planId, b);
    }
    return b;
  };
  for (const s of expected) {
    const b = bucket(s.planId);
    b.esperados += 1;
    if (matchedByExpected.has(s.planExerciseId)) b.completados += 1;
  }
  for (const e of extras) {
    bucket(e.canonicalPlanId ?? e.planId).extras += 1;
  }

  return {
    totalEsperados: expected.length,
    totalCompletados: matchedByExpected.size,
    totalExtras: extras.length,
    porPlan,
    matchedByExpected,
    extras,
    dedupExecutions,
  };
}

/**
 * Regla de estado unificada de sesión (runtime `closeImpl` y migración):
 * - Con esperados: completada ⟺ todos los esperados matcheados.
 * - Sin esperados (día de descanso / sin plan vigente): completada si hubo
 *   trabajo voluntario (extras) — no había nada exigible; parcial si la
 *   sesión existe sin trabajo completado. El `estadoDia` del rollup sigue
 *   siendo `descanso`/`sin_plan` (los extras no alteran la adherencia).
 */
export function computeEstadoSesion(counts: {
  totalEsperados: number;
  totalCompletados: number;
  totalExtras: number;
}): "completada" | "completada_parcial" {
  if (counts.totalEsperados > 0) {
    return counts.totalCompletados >= counts.totalEsperados
      ? "completada"
      : "completada_parcial";
  }
  return counts.totalExtras > 0 ? "completada" : "completada_parcial";
}
