/**
 * Tests unitarios para `sessionCounting.ts`.
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/sessionCounting.test.ts
 */

import { strict as assert } from "node:assert";
import { Id } from "../_generated/dataModel";
import {
  computeDayCounts,
  computeEstadoSesion,
  ExecutionForCount,
  ExpectedSlot,
} from "./sessionCounting";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

const pe = (n: number) => `pe${n}` as Id<"planExercises">;
const ex = (n: number) => `ex${n}` as Id<"exercises">;
const plan = (n: number) => `plan${n}` as Id<"plans">;
const eid = (n: number) => `exec${n}` as Id<"exerciseExecutions">;

function slot(
  n: number,
  opts: { planId?: Id<"plans">; exerciseId?: Id<"exercises">; canonical?: Id<"plans"> } = {},
): ExpectedSlot {
  return {
    planExerciseId: pe(n),
    planId: opts.planId ?? plan(1),
    exerciseId: opts.exerciseId ?? ex(n),
    canonicalPlanId: opts.canonical ?? opts.planId ?? plan(1),
  };
}

let execSeq = 0;
function exec(
  planExerciseN: number,
  opts: Partial<ExecutionForCount> & { exerciseN?: number } = {},
): ExecutionForCount {
  execSeq += 1;
  const { exerciseN, ...rest } = opts;
  return {
    executionId: eid(execSeq),
    planExerciseId: pe(planExerciseN),
    planId: plan(1),
    completado: true,
    fechaHora: `2026-06-29T19:30:${String(execSeq).padStart(2, "0")}.000Z`,
    exerciseId: ex(exerciseN ?? planExerciseN),
    canonicalPlanId: rest.planId ?? plan(1),
    ...rest,
  };
}

console.log("sessionCounting.test.ts");

test("identidad simple N/N → todos completados", () => {
  const expected = [slot(1), slot(2), slot(3)];
  const executions = [exec(1), exec(2), exec(3)];
  const c = computeDayCounts(expected, executions);
  assert.equal(c.totalEsperados, 3);
  assert.equal(c.totalCompletados, 3);
  assert.equal(c.totalExtras, 0);
  assert.equal(computeEstadoSesion(c), "completada");
});

test("duplicados del mismo planExercise colapsan a 1", () => {
  const expected = [slot(1), slot(2)];
  const executions = [exec(1), exec(1), exec(1), exec(2)];
  const c = computeDayCounts(expected, executions);
  assert.equal(c.totalCompletados, 2);
  assert.equal(c.totalExtras, 0);
  assert.equal(c.dedupExecutions.length, 2);
});

test("representante de duplicados prefiere la fila con feedback", () => {
  const expected = [slot(1)];
  const conNota = exec(1, { notaPaciente: "me dolió", dolorEscala: 4 });
  const sinNota = exec(1); // fechaHora posterior pero sin feedback
  const c = computeDayCounts(expected, [conNota, sinNota]);
  assert.equal(c.matchedByExpected.get(pe(1))?.executionId, conNota.executionId);
});

test("caso real 29-06: 8 ejecuciones no programadas + 0/7 programados", () => {
  // 7 esperados del plan A; 8 ejecuciones de planExercises del plan B con
  // exerciseIds que no intersectan.
  const expected = Array.from({ length: 7 }, (_, i) => slot(i + 1, { planId: plan(1) }));
  const executions = Array.from({ length: 8 }, (_, i) =>
    exec(100 + i, { planId: plan(2), canonicalPlanId: plan(2), exerciseN: 100 + i }),
  );
  const c = computeDayCounts(expected, executions);
  assert.equal(c.totalEsperados, 7);
  assert.equal(c.totalCompletados, 0);
  assert.equal(c.totalExtras, 8);
  assert.equal(computeEstadoSesion(c), "completada_parcial");
  assert.equal(c.porPlan.get(plan(1))?.esperados, 7);
  assert.equal(c.porPlan.get(plan(1))?.completados, 0);
  assert.equal(c.porPlan.get(plan(2))?.extras, 8);
});

test("fallback pasada 2: misma cadena de versiones por exerciseId", () => {
  // Esperado del plan v2 (canónico plan(9)); ejecución apunta al planExercise
  // de la v1 (otro planExerciseId) pero mismo exerciseId y misma cadena.
  const expected = [slot(1, { planId: plan(2), exerciseId: ex(50), canonical: plan(9) })];
  const executions = [
    exec(999, { planId: plan(1), canonicalPlanId: plan(9), exerciseN: 50 }),
  ];
  const c = computeDayCounts(expected, executions);
  assert.equal(c.totalCompletados, 1);
  assert.equal(c.totalExtras, 0);
});

test("fallback pasada 3: exerciseId global cruza familias de planes", () => {
  const expected = [slot(1, { planId: plan(2), exerciseId: ex(50), canonical: plan(2) })];
  const executions = [
    exec(999, { planId: plan(7), canonicalPlanId: plan(7), exerciseN: 50 }),
  ];
  const c = computeDayCounts(expected, executions);
  assert.equal(c.totalCompletados, 1);
  assert.equal(c.totalExtras, 0);
});

test("dos esperados con el mismo exerciseId y una sola ejecución → 1 matched", () => {
  const expected = [
    slot(1, { exerciseId: ex(50) }),
    slot(2, { exerciseId: ex(50) }),
  ];
  const executions = [exec(999, { exerciseN: 50 })];
  const c = computeDayCounts(expected, executions);
  assert.equal(c.totalCompletados, 1);
  assert.equal(c.totalExtras, 0);
});

test("ejecución huérfana (planExercise borrado, sin exerciseId) → extra, sin crash", () => {
  const expected = [slot(1)];
  const executions = [exec(999, { exerciseId: undefined })];
  const c = computeDayCounts(expected, executions);
  assert.equal(c.totalCompletados, 0);
  assert.equal(c.totalExtras, 1);
});

test("día de descanso con extras → esperados 0, estado completada, estadoDia lo decide el rollup", () => {
  const executions = [exec(1), exec(2)];
  const c = computeDayCounts([], executions);
  assert.equal(c.totalEsperados, 0);
  assert.equal(c.totalCompletados, 0);
  assert.equal(c.totalExtras, 2);
  assert.equal(computeEstadoSesion(c), "completada");
});

test("sesión sin trabajo completado → completada_parcial", () => {
  const noCompletada = exec(1, { completado: false });
  const c = computeDayCounts([], [noCompletada]);
  assert.equal(c.totalExtras, 0);
  assert.equal(computeEstadoSesion(c), "completada_parcial");
});

test("no-completadas no matchean ni son extra, pero están en dedupExecutions", () => {
  const expected = [slot(1)];
  const c = computeDayCounts(expected, [exec(1, { completado: false })]);
  assert.equal(c.totalCompletados, 0);
  assert.equal(c.totalExtras, 0);
  assert.equal(c.dedupExecutions.length, 1);
});

test("identidad tiene prioridad sobre fallback por exerciseId", () => {
  // Dos esperados: pe1 (ex50) y pe2 (ex50). Ejecuciones: una de pe2 y una de
  // pe999 con ex50. La de pe2 debe matchear pe2 por identidad; la otra cae a pe1.
  const expected = [
    slot(1, { exerciseId: ex(50) }),
    slot(2, { exerciseId: ex(50) }),
  ];
  const directa = exec(2, { exerciseN: 50 });
  const cruzada = exec(999, { exerciseN: 50 });
  const c = computeDayCounts(expected, [cruzada, directa]);
  assert.equal(c.totalCompletados, 2);
  assert.equal(c.matchedByExpected.get(pe(2))?.executionId, directa.executionId);
  assert.equal(c.matchedByExpected.get(pe(1))?.executionId, cruzada.executionId);
});

test("extras se atribuyen al plan canónico en porPlan", () => {
  const expected = [slot(1, { planId: plan(1) })];
  const extra = exec(500, { planId: plan(3), canonicalPlanId: plan(4), exerciseN: 500 });
  const c = computeDayCounts(expected, [exec(1), extra]);
  assert.equal(c.porPlan.get(plan(4))?.extras, 1);
  assert.equal(c.porPlan.get(plan(4))?.esperados, 0);
});

test("totalCompletados nunca supera totalEsperados", () => {
  const expected = [slot(1)];
  const executions = [exec(1), exec(1, { exerciseN: 1 }), exec(2, { exerciseN: 1 })];
  const c = computeDayCounts(expected, executions);
  assert.equal(c.totalCompletados, 1);
  assert.ok(c.totalCompletados <= c.totalEsperados);
  // El grupo dedup de pe1 consume el slot; la ejecución de pe2 (mismo
  // exerciseId) queda como extra.
  assert.equal(c.totalExtras, 1);
});
