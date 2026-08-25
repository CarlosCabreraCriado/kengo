/**
 * Tests unitarios del diff de asignaciones paciente→fisio responsable.
 *
 * El caso que motiva el fichero es la regresión "cambiar el responsable de un
 * paciente deja sin responsable a todos los demás de la clínica": la pantalla
 * de asignación solo envía el diff editado y `bulkAssign` borraba la clínica
 * entera antes de reinsertar.
 *
 * Cómo correr:
 *   npx tsx convex/assignments/_helpers.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";
import {
  planAssignmentDiff,
  type AssignmentRow,
} from "./_helpers";

const EXISTENTES: AssignmentRow[] = [
  { _id: "a1", pacienteId: "p1", fisioId: "fA" },
  { _id: "a2", pacienteId: "p2", fisioId: "fA" },
  { _id: "a3", pacienteId: "p3", fisioId: "fB" },
];

function run(nombre: string, fn: () => void) {
  fn();
  console.log(`  ✓ ${nombre}`);
}

console.log("planAssignmentDiff");

run("cambiar un responsable no toca a los demás pacientes", () => {
  const { ops, asignadas, eliminadas } = planAssignmentDiff(EXISTENTES, [
    { pacienteId: "p1", fisioId: "fB" },
  ]);

  assert.deepEqual(ops, [{ kind: "patch", assignmentId: "a1", fisioId: "fB" }]);
  assert.equal(asignadas, 1);
  assert.equal(eliminadas, 0);
  // El invariante central: p2 y p3 no aparecen en ninguna op.
  const tocados = ops.map((o) =>
    o.kind === "insert" ? o.pacienteId : o.assignmentId,
  );
  assert.ok(!tocados.includes("a2"));
  assert.ok(!tocados.includes("a3"));
});

run("un paciente sin asignación previa se da de alta", () => {
  const { ops, asignadas, eliminadas } = planAssignmentDiff(EXISTENTES, [
    { pacienteId: "p4", fisioId: "fA" },
  ]);

  assert.deepEqual(ops, [
    { kind: "insert", pacienteId: "p4", fisioId: "fA" },
  ]);
  assert.equal(asignadas, 1);
  assert.equal(eliminadas, 0);
});

run("fisioId null retira la asignación existente", () => {
  const { ops, asignadas, eliminadas } = planAssignmentDiff(EXISTENTES, [
    { pacienteId: "p2", fisioId: null },
  ]);

  assert.deepEqual(ops, [{ kind: "delete", assignmentId: "a2" }]);
  assert.equal(asignadas, 0);
  assert.equal(eliminadas, 1);
});

run("fisioId null sobre un paciente sin asignación es no-op", () => {
  const { ops, asignadas, eliminadas } = planAssignmentDiff(EXISTENTES, [
    { pacienteId: "p9", fisioId: null },
  ]);

  assert.deepEqual(ops, []);
  assert.equal(asignadas, 0);
  assert.equal(eliminadas, 0);
});

run("reasignar al mismo fisio no genera escritura", () => {
  const { ops, asignadas, eliminadas } = planAssignmentDiff(EXISTENTES, [
    { pacienteId: "p1", fisioId: "fA" },
  ]);

  assert.deepEqual(ops, []);
  assert.equal(asignadas, 0);
  assert.equal(eliminadas, 0);
});

run("payload vacío no genera ninguna operación", () => {
  const { ops } = planAssignmentDiff(EXISTENTES, []);
  assert.deepEqual(ops, []);
});

run("mezcla de altas, cambios y bajas en un solo payload", () => {
  const { ops, asignadas, eliminadas } = planAssignmentDiff(EXISTENTES, [
    { pacienteId: "p1", fisioId: "fB" },
    { pacienteId: "p3", fisioId: null },
    { pacienteId: "p4", fisioId: "fB" },
  ]);

  assert.deepEqual(ops, [
    { kind: "patch", assignmentId: "a1", fisioId: "fB" },
    { kind: "delete", assignmentId: "a3" },
    { kind: "insert", pacienteId: "p4", fisioId: "fB" },
  ]);
  assert.equal(asignadas, 2);
  assert.equal(eliminadas, 1);
});

run("si el payload repite un paciente gana la última entrada", () => {
  const { ops, asignadas, eliminadas } = planAssignmentDiff(EXISTENTES, [
    { pacienteId: "p1", fisioId: "fB" },
    { pacienteId: "p1", fisioId: null },
  ]);

  assert.deepEqual(ops, [{ kind: "delete", assignmentId: "a1" }]);
  assert.equal(asignadas, 0);
  assert.equal(eliminadas, 1);
});

console.log("\nTodos los tests de planAssignmentDiff pasan.");
