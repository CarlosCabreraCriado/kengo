/**
 * Tests unitarios para `virtualDaily.ts`.
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/virtualDaily.test.ts
 */

import { strict as assert } from "node:assert";
import { Id } from "../_generated/dataModel";
import { buildVirtualDailyRollup, missingDatesInRange } from "./virtualDaily";
import type { ExpectedExerciseItem } from "./expectedExercises";

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

const PACIENTE = "u1" as Id<"users">;
const CLINICA = "c1" as Id<"clinics">;
const PLAN_A = "pA" as Id<"plans">;
const PLAN_B = "pB" as Id<"plans">;

function expected(planId: Id<"plans">, n: number): ExpectedExerciseItem[] {
  return Array.from({ length: n }, (_, i) => ({
    planExerciseId: `${planId}-pe${i}` as Id<"planExercises">,
    planId,
    exerciseId: `ex${i}` as Id<"exercises">,
  }));
}

console.log("virtualDaily.test.ts");

test("missingDatesInRange: rango completo sin presentes", () => {
  assert.deepEqual(missingDatesInRange("2026-08-17", "2026-08-19", new Set()), [
    "2026-08-17",
    "2026-08-18",
    "2026-08-19",
  ]);
});

test("missingDatesInRange: excluye las fechas presentes", () => {
  assert.deepEqual(
    missingDatesInRange("2026-08-17", "2026-08-19", new Set(["2026-08-18"])),
    ["2026-08-17", "2026-08-19"],
  );
});

test("missingDatesInRange: desde > hasta → vacío (rango en el futuro)", () => {
  assert.deepEqual(missingDatesInRange("2026-08-24", "2026-08-23", new Set()), []);
});

test("buildVirtualDailyRollup: plan con ejercicios esperados → fallido", () => {
  const r = buildVirtualDailyRollup({
    pacienteId: PACIENTE,
    clinicId: CLINICA,
    fecha: "2026-08-19",
    planIds: [PLAN_A],
    expected: expected(PLAN_A, 5),
    ahora: 123,
  });
  assert.equal(r.estadoDia, "fallido");
  assert.equal(r.totalEsperados, 5);
  assert.equal(r.totalCompletados, 0);
  assert.equal(r.totalExtras, 0);
  assert.deepEqual(r.sessionIds, []);
  assert.deepEqual(r.planAggregates, [
    { planId: PLAN_A, esperados: 5, completados: 0, extras: 0 },
  ]);
  assert.equal(r.virtual, true);
  assert.equal(r.actualizadoEn, 123);
  assert.equal(r.fecha, "2026-08-19");
});

test("buildVirtualDailyRollup: plan vigente sin ejercicios ese día → descanso", () => {
  const r = buildVirtualDailyRollup({
    pacienteId: PACIENTE,
    clinicId: CLINICA,
    fecha: "2026-08-20",
    planIds: [PLAN_A],
    expected: [],
    ahora: 0,
  });
  assert.equal(r.estadoDia, "descanso");
  assert.equal(r.totalEsperados, 0);
  assert.deepEqual(r.planAggregates, [
    { planId: PLAN_A, esperados: 0, completados: 0, extras: 0 },
  ]);
});

test("buildVirtualDailyRollup: sin planes → sin_plan", () => {
  const r = buildVirtualDailyRollup({
    pacienteId: PACIENTE,
    clinicId: CLINICA,
    fecha: "2026-08-20",
    planIds: [],
    expected: [],
    ahora: 0,
  });
  assert.equal(r.estadoDia, "sin_plan");
  assert.deepEqual(r.planAggregates, []);
});

test("buildVirtualDailyRollup: dos planes, uno de ellos en descanso", () => {
  const r = buildVirtualDailyRollup({
    pacienteId: PACIENTE,
    clinicId: CLINICA,
    fecha: "2026-08-19",
    planIds: [PLAN_A, PLAN_B],
    expected: expected(PLAN_B, 2),
    ahora: 0,
  });
  assert.equal(r.estadoDia, "fallido");
  assert.equal(r.totalEsperados, 2);
  assert.deepEqual(
    r.planAggregates.map((p) => [p.planId, p.esperados]),
    [
      [PLAN_A, 0],
      [PLAN_B, 2],
    ],
  );
});
