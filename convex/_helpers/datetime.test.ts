/**
 * Tests unitarios para `datetime.ts`.
 *
 * Cómo correr (manual, mientras no haya jest project para `convex/`):
 *   npx tsx convex/_helpers/datetime.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";
import {
  anioMes,
  anioSemanaISO,
  diffDaysYMD,
  endOfISOWeek,
  endOfMonth,
  getCurrentMadridDate,
  getMadridDateOffset,
  madridCronHourForLocal2355,
  rangeOfDates,
  startOfISOWeek,
  startOfMonth,
} from "./datetime";

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

console.log("datetime.test.ts");

test("getCurrentMadridDate: devuelve YYYY-MM-DD", () => {
  // 2026-04-27 03:00 UTC = 2026-04-27 05:00 Madrid (CEST).
  const d = new Date("2026-04-27T03:00:00Z");
  assert.equal(getCurrentMadridDate(d), "2026-04-27");
});

test("getCurrentMadridDate: 23:00 UTC en abril (CEST) = día siguiente Madrid", () => {
  // 23:00 UTC en abril = 01:00 Madrid (CEST), día siguiente.
  const d = new Date("2026-04-26T23:00:00Z");
  assert.equal(getCurrentMadridDate(d), "2026-04-27");
});

test("getMadridDateOffset: -1 retrocede un día", () => {
  const d = new Date("2026-04-27T10:00:00Z");
  assert.equal(getMadridDateOffset(-1, d), "2026-04-26");
  assert.equal(getMadridDateOffset(0, d), "2026-04-27");
  assert.equal(getMadridDateOffset(1, d), "2026-04-28");
});

test("anioSemanaISO: 1 enero 2024 cae en 2024-W01 (es lunes)", () => {
  assert.equal(anioSemanaISO("2024-01-01"), "2024-W01");
});

test("anioSemanaISO: 1 enero 2026 cae en 2026-W01 (es jueves)", () => {
  assert.equal(anioSemanaISO("2026-01-01"), "2026-W01");
});

test("anioSemanaISO: 31 dic 2024 cae en 2025-W01 (es martes)", () => {
  // 31 dic 2024 (martes) pertenece a la semana ISO que contiene el 4 ene 2025.
  assert.equal(anioSemanaISO("2024-12-31"), "2025-W01");
});

test("anioSemanaISO: 27 abril 2026 (lunes) → 2026-W18", () => {
  assert.equal(anioSemanaISO("2026-04-27"), "2026-W18");
});

test("anioMes: extrae YYYY-MM", () => {
  assert.equal(anioMes("2026-04-27"), "2026-04");
  assert.equal(anioMes("2025-12-31"), "2025-12");
});

test("startOfISOWeek / endOfISOWeek: 2026-W18 = 27 abril a 3 mayo", () => {
  assert.equal(startOfISOWeek("2026-W18"), "2026-04-27");
  assert.equal(endOfISOWeek("2026-W18"), "2026-05-03");
});

test("startOfISOWeek: 2025-W01 (semana del 30 dic 2024)", () => {
  assert.equal(startOfISOWeek("2025-W01"), "2024-12-30");
});

test("startOfMonth / endOfMonth", () => {
  assert.equal(startOfMonth("2026-02"), "2026-02-01");
  assert.equal(endOfMonth("2026-02"), "2026-02-28");
  assert.equal(endOfMonth("2024-02"), "2024-02-29"); // bisiesto
  assert.equal(endOfMonth("2026-04"), "2026-04-30");
  assert.equal(endOfMonth("2026-12"), "2026-12-31");
});

test("rangeOfDates: 3 días consecutivos", () => {
  assert.deepEqual(rangeOfDates("2026-04-27", "2026-04-29"), [
    "2026-04-27",
    "2026-04-28",
    "2026-04-29",
  ]);
});

test("rangeOfDates: mismo día devuelve array de 1", () => {
  assert.deepEqual(rangeOfDates("2026-04-27", "2026-04-27"), ["2026-04-27"]);
});

test("madridCronHourForLocal2355: en abril (CEST) = 21 UTC", () => {
  // CEST = UTC+2 en abril → 23:55 Madrid = 21:55 UTC.
  const d = new Date("2026-04-15T12:00:00Z");
  assert.equal(madridCronHourForLocal2355(d), 21);
});

test("madridCronHourForLocal2355: en enero (CET) = 22 UTC", () => {
  // CET = UTC+1 en enero → 23:55 Madrid = 22:55 UTC.
  const d = new Date("2026-01-15T12:00:00Z");
  assert.equal(madridCronHourForLocal2355(d), 22);
});

test("diffDaysYMD: diferencia positiva, cero y negativa", () => {
  assert.equal(diffDaysYMD("2026-07-15", "2026-07-15"), 0);
  assert.equal(diffDaysYMD("2026-07-12", "2026-07-15"), 3);
  assert.equal(diffDaysYMD("2026-07-15", "2026-07-12"), -3);
});

test("diffDaysYMD: cruza límite de mes/año", () => {
  assert.equal(diffDaysYMD("2026-06-30", "2026-07-01"), 1);
  assert.equal(diffDaysYMD("2025-12-31", "2026-01-01"), 1);
});

console.log("done.");
