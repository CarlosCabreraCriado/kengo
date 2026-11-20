/**
 * Tests unitarios para `exercises.ts` y el validador `ejercicioPrescritoArgs`.
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/exercises.test.ts
 */

import { strict as assert } from "node:assert";
import {
  normalizarMetricaEjercicio,
  sanearEjercicioPrescrito,
} from "./exercises";
import { ejercicioPrescritoArgs } from "./validators";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("sanearEjercicioPrescrito");

test("casillas vaciadas en el builder (null) quedan como campo ausente", () => {
  const out = sanearEjercicioPrescrito({
    exerciseId: "ex1",
    sort: 1,
    tipo: "repeticiones",
    series: null,
    repeticiones: null,
    duracionSeg: null,
    descansoSeg: null,
    diasSemana: null,
    instruccionesPaciente: null,
    notasFisio: null,
  });
  for (const [k, val] of Object.entries(out)) {
    assert.notEqual(val, null, `${k} no debe ser null`);
  }
  assert.equal(out.series, undefined);
  assert.equal(out.repeticiones, undefined);
  assert.equal(out.descansoSeg, undefined);
  assert.equal(out.diasSemana, undefined);
  assert.equal(out.exerciseId, "ex1");
  assert.equal(out.sort, 1);
});

test("conserva los valores válidos, incluido el descanso 0", () => {
  const out = sanearEjercicioPrescrito({
    exerciseId: "ex1",
    sort: 2,
    tipo: "repeticiones",
    series: 3,
    repeticiones: 12,
    descansoSeg: 0,
    diasSemana: ["L", "X"],
    instruccionesPaciente: "",
    notasFisio: "nota",
  });
  assert.deepEqual(out, {
    exerciseId: "ex1",
    sort: 2,
    tipo: "repeticiones",
    series: 3,
    repeticiones: 12,
    duracionSeg: undefined,
    descansoSeg: 0,
    diasSemana: ["L", "X"],
    instruccionesPaciente: "",
    notasFisio: "nota",
  });
});

test("NaN se trata como casilla vacía", () => {
  const out = sanearEjercicioPrescrito({
    exerciseId: "ex1",
    sort: 1,
    series: Number.NaN,
  });
  assert.equal(out.series, undefined);
});

test("mantiene la invariante de métrica (duración descarta repeticiones)", () => {
  const out = sanearEjercicioPrescrito({
    exerciseId: "ex1",
    sort: 1,
    tipo: "duracion",
    repeticiones: 12,
    duracionSeg: null,
  });
  assert.equal(out.repeticiones, undefined);
  assert.equal(out.duracionSeg, undefined);
  assert.equal(out.tipo, "duracion");
});

test("tipo null se trata como legacy (repeticiones)", () => {
  const out = sanearEjercicioPrescrito({
    exerciseId: "ex1",
    sort: 1,
    tipo: null,
    repeticiones: 10,
    duracionSeg: 30,
  });
  assert.equal(out.tipo, undefined);
  assert.equal(out.repeticiones, 10);
  assert.equal(out.duracionSeg, undefined);
});

test("normalizarMetricaEjercicio sigue intacto", () => {
  assert.deepEqual(
    normalizarMetricaEjercicio({ tipo: "duracion", repeticiones: 5, duracionSeg: 30 }),
    { tipo: "duracion", repeticiones: undefined, duracionSeg: 30 },
  );
});

console.log("ejercicioPrescritoArgs");

test("los campos opcionales aceptan null; exerciseId y sort siguen obligatorios", () => {
  const fields = ejercicioPrescritoArgs.fields as Record<
    string,
    { isOptional: string; kind: string; members?: { kind: string }[] }
  >;
  for (const k of [
    "tipo",
    "series",
    "repeticiones",
    "duracionSeg",
    "descansoSeg",
    "diasSemana",
    "instruccionesPaciente",
    "notasFisio",
  ]) {
    const f = fields[k];
    assert.equal(f.isOptional, "optional", `${k} debe ser opcional`);
    assert.equal(f.kind, "union", `${k} debe ser una unión`);
    assert.ok(
      f.members?.some((m) => m.kind === "null"),
      `${k} debe admitir null`,
    );
  }
  assert.equal(fields["exerciseId"].isOptional, "required");
  assert.equal(fields["sort"].isOptional, "required");
});

console.log(`\n${passed} tests OK`);
