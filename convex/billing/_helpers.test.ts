/**
 * Tests unitarios para `_helpers.ts` (tabla de planes pricing v2).
 *
 * Cómo correr (manual, mientras no haya jest project para `convex/`):
 *   npx tsx convex/billing/_helpers.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";
import {
  PLANES,
  LIMITE_FISIOS_AUTOSERVICIO,
  planParaFisios,
  precioParaFisios,
  limitePacientesParaFisios,
  requiereContactoVentas,
} from "./_helpers";

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

console.log("_helpers.test.ts");

// --- tabla de planes ---

test("PLANES: tres planes Lonely/Smart/Medium con precios v2", () => {
  assert.equal(PLANES.length, 3);
  assert.deepEqual(
    PLANES.map((p) => p.nombre),
    ["Lonely", "Smart", "Medium"],
  );
  assert.deepEqual(
    PLANES.map((p) => p.precioBaseEur),
    [89, 249, 449],
  );
  assert.deepEqual(
    PLANES.map((p) => p.precioIlimitadoEur),
    [109, 279, 489],
  );
  assert.deepEqual(
    PLANES.map((p) => p.limitePacientes),
    [150, 300, 500],
  );
});

test("LIMITE_FISIOS_AUTOSERVICIO = 9 (antes 10)", () => {
  assert.equal(LIMITE_FISIOS_AUTOSERVICIO, 9);
});

// --- planParaFisios (fronteras) ---

test("planParaFisios: fronteras de tramo", () => {
  assert.equal(planParaFisios(0), null);
  assert.equal(planParaFisios(1)?.nombre, "Lonely");
  assert.equal(planParaFisios(2)?.nombre, "Smart");
  assert.equal(planParaFisios(4)?.nombre, "Smart");
  assert.equal(planParaFisios(5)?.nombre, "Medium");
  assert.equal(planParaFisios(9)?.nombre, "Medium");
  assert.equal(planParaFisios(10), null); // enterprise
});

// --- precioParaFisios (6 combinaciones + fuera de tramo) ---

test("precioParaFisios: variante base", () => {
  assert.equal(precioParaFisios(1, "base"), 89);
  assert.equal(precioParaFisios(3, "base"), 249);
  assert.equal(precioParaFisios(9, "base"), 449);
});

test("precioParaFisios: variante ilimitada", () => {
  assert.equal(precioParaFisios(1, "ilimitada"), 109);
  assert.equal(precioParaFisios(4, "ilimitada"), 279);
  assert.equal(precioParaFisios(5, "ilimitada"), 489);
});

test("precioParaFisios: fuera de tramo → 0", () => {
  assert.equal(precioParaFisios(0, "base"), 0);
  assert.equal(precioParaFisios(10, "ilimitada"), 0);
});

// --- limitePacientesParaFisios ---

test("limitePacientesParaFisios: base → cap del tramo", () => {
  assert.equal(limitePacientesParaFisios(1, "base"), 150);
  assert.equal(limitePacientesParaFisios(4, "base"), 300);
  assert.equal(limitePacientesParaFisios(9, "base"), 500);
});

test("limitePacientesParaFisios: ilimitada → null (sin cap)", () => {
  assert.equal(limitePacientesParaFisios(1, "ilimitada"), null);
  assert.equal(limitePacientesParaFisios(9, "ilimitada"), null);
});

test("limitePacientesParaFisios: fuera de tramo (enterprise) → null", () => {
  assert.equal(limitePacientesParaFisios(0, "base"), null);
  assert.equal(limitePacientesParaFisios(10, "base"), null);
});

// --- requiereContactoVentas ---

test("requiereContactoVentas: 9 no, 10 sí", () => {
  assert.equal(requiereContactoVentas(9), false);
  assert.equal(requiereContactoVentas(10), true);
});
