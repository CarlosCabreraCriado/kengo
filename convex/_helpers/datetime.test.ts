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
  getCurrentDateInTz,
  getCurrentMadridDate,
  getDateOffsetInTz,
  getMadridDateOffset,
  isValidIanaTimezone,
  rangeOfDates,
  shouldCloseSession,
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

test("getCurrentDateInTz: Canarias 23:30 local sigue siendo el MISMO día", () => {
  // Viernes 23:30 en Canarias (UTC+0 invierno) = sábado 00:30 Madrid.
  // Este es el bug reportado: con Madrid daría 2026-01-17.
  const d = new Date("2026-01-16T23:30:00Z");
  assert.equal(getCurrentDateInTz("Atlantic/Canary", d), "2026-01-16");
  assert.equal(getCurrentDateInTz("Europe/Madrid", d), "2026-01-17");
});

test("getCurrentDateInTz: Canarias en verano (UTC+1) misma ventana", () => {
  // 23:30 Canarias en julio = 22:30 UTC = 00:30 Madrid del día siguiente.
  const d = new Date("2026-07-10T22:30:00Z");
  assert.equal(getCurrentDateInTz("Atlantic/Canary", d), "2026-07-10");
  assert.equal(getCurrentDateInTz("Europe/Madrid", d), "2026-07-11");
});

test("getCurrentDateInTz: TZs extremas", () => {
  const d = new Date("2026-01-16T23:30:00Z");
  // LA (UTC-8): aún es por la tarde del día 16.
  assert.equal(getCurrentDateInTz("America/Los_Angeles", d), "2026-01-16");
  // Kiritimati (UTC+14): ya es día 17 por la tarde.
  assert.equal(getCurrentDateInTz("Pacific/Kiritimati", d), "2026-01-17");
});

test("getCurrentDateInTz: transiciones DST Madrid", () => {
  // 29 mar 2026 01:30 UTC = 02:30→03:30 CEST (salto): sigue siendo día 29.
  assert.equal(
    getCurrentDateInTz("Europe/Madrid", new Date("2026-03-29T01:30:00Z")),
    "2026-03-29",
  );
  // 25 oct 2026 (vuelta a CET) 23:30 UTC = 00:30 CET del 26.
  assert.equal(
    getCurrentDateInTz("Europe/Madrid", new Date("2026-10-25T23:30:00Z")),
    "2026-10-26",
  );
});

test("getDateOffsetInTz: offsets en la TZ pedida", () => {
  const d = new Date("2026-01-16T23:30:00Z");
  assert.equal(getDateOffsetInTz("Atlantic/Canary", 0, d), "2026-01-16");
  assert.equal(getDateOffsetInTz("Atlantic/Canary", -1, d), "2026-01-15");
  assert.equal(getDateOffsetInTz("Europe/Madrid", -1, d), "2026-01-16");
});

test("isValidIanaTimezone", () => {
  assert.equal(isValidIanaTimezone("Atlantic/Canary"), true);
  assert.equal(isValidIanaTimezone("Europe/Madrid"), true);
  assert.equal(isValidIanaTimezone("UTC"), true);
  assert.equal(isValidIanaTimezone("Europe/Madrid "), false);
  assert.equal(isValidIanaTimezone("<script>"), false);
  assert.equal(isValidIanaTimezone(""), false);
  assert.equal(isValidIanaTimezone("Not/AZone"), false);
  assert.equal(isValidIanaTimezone("a".repeat(65)), false);
});

test("shouldCloseSession: no cierra el día en curso del paciente", () => {
  // Cron a las 02:00 UTC del 17 ene (03:00 Madrid del 17).
  const cronRun = new Date("2026-01-17T02:00:00Z");
  // Canario con sesión del 16: su día 16 ya acabó (son las 02:00 del 17) → cierra.
  assert.equal(shouldCloseSession("2026-01-16", "Atlantic/Canary", cronRun), true);
  // Honolulu (UTC-10): a las 02:00 UTC del 17 aún son las 16:00 del 16 → NO cierra.
  assert.equal(
    shouldCloseSession("2026-01-16", "Pacific/Honolulu", cronRun),
    false,
  );
  // Sesión de anteayer en Honolulu → sí cierra.
  assert.equal(
    shouldCloseSession("2026-01-15", "Pacific/Honolulu", cronRun),
    true,
  );
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
