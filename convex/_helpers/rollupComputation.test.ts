/**
 * Tests unitarios para `rollupComputation.ts`.
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/rollupComputation.test.ts
 */

import { strict as assert } from "node:assert";
import {
  computeAggregatesFromExecutions,
  computeEstadoDia,
  computeRachaActual,
  computeRachaMaxima,
  computeRiskScore,
} from "./rollupComputation";

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

console.log("rollupComputation.test.ts");

// computeEstadoDia
test("computeEstadoDia: sin plan → sin_plan", () => {
  assert.equal(computeEstadoDia(0, 0, false), "sin_plan");
  assert.equal(computeEstadoDia(5, 3, false), "sin_plan");
});

test("computeEstadoDia: con plan, esperados=0 → descanso", () => {
  assert.equal(computeEstadoDia(0, 0, true), "descanso");
});

test("computeEstadoDia: completados >= esperados → completado", () => {
  assert.equal(computeEstadoDia(5, 5, true), "completado");
  assert.equal(computeEstadoDia(5, 7, true), "completado"); // más de lo esperado
});

test("computeEstadoDia: 0 < completados < esperados → parcial", () => {
  assert.equal(computeEstadoDia(5, 2, true), "parcial");
});

test("computeEstadoDia: completados=0, esperados>0 → fallido", () => {
  assert.equal(computeEstadoDia(5, 0, true), "fallido");
});

// computeRachaMaxima
test("computeRachaMaxima: lista vacía → 0", () => {
  assert.equal(computeRachaMaxima([]), 0);
});

test("computeRachaMaxima: todos completados → length", () => {
  assert.equal(
    computeRachaMaxima(["completado", "completado", "completado"]),
    3,
  );
});

test("computeRachaMaxima: descanso no rompe la racha", () => {
  assert.equal(
    computeRachaMaxima([
      "completado",
      "descanso",
      "completado",
      "completado",
    ]),
    3,
  );
});

test("computeRachaMaxima: parcial corta la racha", () => {
  assert.equal(
    computeRachaMaxima(["completado", "completado", "parcial", "completado"]),
    2,
  );
});

// computeRachaActual
test("computeRachaActual: termina en parcial → 0", () => {
  assert.equal(computeRachaActual(["completado", "completado", "parcial"]), 0);
});

test("computeRachaActual: termina en completado tras descanso → cuenta", () => {
  assert.equal(
    computeRachaActual(["completado", "descanso", "completado", "completado"]),
    3, // los descansos cuentan dentro de la racha
  );
});

test("computeRachaActual: ['fallido', 'completado'] → 1", () => {
  assert.equal(computeRachaActual(["fallido", "completado"]), 1);
});

// computeAggregatesFromExecutions
test("computeAggregatesFromExecutions: lista vacía", () => {
  const out = computeAggregatesFromExecutions([]);
  assert.equal(out.totalCompletados, 0);
  assert.equal(out.dolorMin, undefined);
  assert.equal(out.dolorMax, undefined);
  assert.equal(out.dolorPromedio, undefined);
  assert.equal(out.esfuerzoPromedio, undefined);
  assert.equal(out.duracionTotalSeg, undefined);
});

test("computeAggregatesFromExecutions: 3 completados, dolor 2/5/8", () => {
  const out = computeAggregatesFromExecutions([
    { completado: true, dolorEscala: 2, duracionRealSeg: 60 },
    { completado: true, dolorEscala: 5, duracionRealSeg: 90 },
    { completado: true, dolorEscala: 8, duracionRealSeg: 120 },
  ]);
  assert.equal(out.totalCompletados, 3);
  assert.equal(out.dolorMin, 2);
  assert.equal(out.dolorMax, 8);
  assert.equal(out.dolorPromedio, 5);
  assert.equal(out.duracionTotalSeg, 270);
});

test("computeAggregatesFromExecutions: mixed completados y dolor parcial", () => {
  const out = computeAggregatesFromExecutions([
    { completado: true, dolorEscala: 4 },
    { completado: false }, // sin dolor reportado
    { completado: true, dolorEscala: 6, esfuerzoEscala: 7 },
  ]);
  assert.equal(out.totalCompletados, 2);
  assert.equal(out.dolorMin, 4);
  assert.equal(out.dolorMax, 6);
  assert.equal(out.dolorPromedio, 5);
  assert.equal(out.esfuerzoPromedio, 7);
  assert.equal(out.duracionTotalSeg, undefined);
});

// computeRiskScore
test("computeRiskScore: paciente perfecto (0 inact, 100 adh) → 0", () => {
  assert.equal(
    computeRiskScore({ inactividadDias: 0, adherencia: 100 }),
    0,
  );
});

test("computeRiskScore: 14d inactivo + 0 adh → 90", () => {
  // 50 (inact) + 40 (adh) = 90, sin tendencia.
  assert.equal(
    computeRiskScore({ inactividadDias: 14, adherencia: 0 }),
    90,
  );
});

test("computeRiskScore: tendencia negativa suma hasta 10", () => {
  assert.equal(
    computeRiskScore({
      inactividadDias: 14,
      adherencia: 0,
      tendenciaAdherencia: -25,
    }),
    100, // capa a 10
  );
});

test("computeRiskScore: tendencia positiva no resta", () => {
  assert.equal(
    computeRiskScore({
      inactividadDias: 0,
      adherencia: 100,
      tendenciaAdherencia: 50,
    }),
    0,
  );
});

console.log("done.");
