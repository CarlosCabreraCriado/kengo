/**
 * Tests unitarios para `dropSupersededVersions` (`expectedExercises.ts`).
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/expectedExercises.test.ts
 */

import { strict as assert } from "node:assert";
import { Doc, Id } from "../_generated/dataModel";
import { dropSupersededVersions } from "./expectedExercises";

/**
 * Construye un `Doc<"plans">` mínimo: `dropSupersededVersions` solo usa `_id` y
 * `planSucesor`, el resto se castea para satisfacer el tipo.
 */
function plan(id: string, planSucesor?: string): Doc<"plans"> {
  return {
    _id: id as Id<"plans">,
    planSucesor: planSucesor as Id<"plans"> | undefined,
  } as Doc<"plans">;
}

function ids(plans: Doc<"plans">[]): string[] {
  return plans.map((p) => p._id as string).sort();
}

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

console.log("expectedExercises.test.ts");

test("lista vacía → vacía", () => {
  assert.deepEqual(dropSupersededVersions([]), []);
});

test("plan sin versionar → se conserva", () => {
  const out = dropSupersededVersions([plan("p1")]);
  assert.deepEqual(ids(out), ["p1"]);
});

test("2 versiones ambas vigentes → solo la nueva (descarta el modificado)", () => {
  const out = dropSupersededVersions([plan("p1", "p2"), plan("p2")]);
  assert.deepEqual(ids(out), ["p2"]);
});

test("cadena de 3 versiones todas vigentes → solo la última", () => {
  const out = dropSupersededVersions([
    plan("p1", "p2"),
    plan("p2", "p3"),
    plan("p3"),
  ]);
  assert.deepEqual(ids(out), ["p3"]);
});

test("sucesor NO vigente (no está en la lista) → se conserva el predecesor", () => {
  // Día pre-versionado: solo el plan viejo está vigente; su sucesor existe pero
  // no entra en la lista (fechaInicio futura). Debe mantenerse el viejo.
  const out = dropSupersededVersions([plan("p1", "p2")]);
  assert.deepEqual(ids(out), ["p1"]);
});

test("solape parcial: viejo + intermedio vigentes, último no → queda el intermedio", () => {
  const out = dropSupersededVersions([plan("p1", "p2"), plan("p2", "p3")]);
  assert.deepEqual(ids(out), ["p2"]);
});

test("planes independientes (sin relación de versión) → se conservan todos", () => {
  const out = dropSupersededVersions([plan("a"), plan("b"), plan("c")]);
  assert.deepEqual(ids(out), ["a", "b", "c"]);
});
