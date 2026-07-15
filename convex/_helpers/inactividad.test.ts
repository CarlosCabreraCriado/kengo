/**
 * Tests unitarios para `inactividad.ts` (`getReferenciaInactividad`).
 *
 * Cómo correr (manual, mientras no haya jest project para `convex/`):
 *   npx tsx convex/_helpers/inactividad.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 *
 * Usa un `ctx` falso mínimo: el query builder ignora índice/filtro y devuelve
 * las filas sembradas (el helper filtra planes en memoria por clínica y
 * `isPlanEnCurso`, y usa `.first()` para la membership).
 */

import { strict as assert } from "node:assert";
import { Id } from "../_generated/dataModel";
import { getReferenciaInactividad } from "./inactividad";
import { diffDaysYMD } from "./datetime";

const HOY = "2026-07-15";
const PACIENTE = "p1" as unknown as Id<"users">;
const CLINIC = "c1" as unknown as Id<"clinics">;

type FakePlan = {
  _id: string;
  _creationTime: number;
  pacienteId: string;
  clinicId: string;
  estado: string;
  fechaInicio?: string;
  fechaFin?: string;
};
type FakeMembership = {
  _id: string;
  _creationTime: number;
  userId: string;
  clinicId: string;
  puesto: string;
};

/** ms de un YYYY-MM-DD a mediodía UTC (evita cruces de TZ en el test). */
function ms(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getTime();
}

function plan(overrides: Partial<FakePlan>): FakePlan {
  return {
    _id: "plan1",
    _creationTime: ms("2026-01-01"),
    pacienteId: PACIENTE,
    clinicId: CLINIC,
    estado: "activo",
    fechaFin: "2026-12-31", // futuro → en curso salvo que fechaInicio sea futura
    ...overrides,
  };
}

function membership(creationYmd: string): FakeMembership {
  return {
    _id: "mem1",
    _creationTime: ms(creationYmd),
    userId: PACIENTE,
    clinicId: CLINIC,
    puesto: "paciente",
  };
}

function makeCtx(plans: FakePlan[], mem: FakeMembership | null) {
  const chain = (rows: unknown[]) => ({
    withIndex: () => chain(rows),
    filter: () => chain(rows),
    collect: async () => rows,
    first: async () => rows[0] ?? null,
  });
  return {
    db: {
      query: (table: string) => {
        if (table === "plans") return chain(plans);
        if (table === "clinicMemberships") return chain(mem ? [mem] : []);
        return chain([]);
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function test(name: string, fn: () => void | Promise<void>) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${name}`))
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      console.error(err);
      process.exitCode = 1;
    });
}

/** inactividadDias en la rama sin actividad, tal como lo calcula el snapshot. */
function inactividadDias(ref: string, dias = 7): number {
  return Math.min(dias, Math.max(0, diffDaysYMD(ref, HOY)));
}

console.log("inactividad.test.ts");

test("plan iniciado HOY, alta antigua → 0 días (no alerta)", async () => {
  const ctx = makeCtx(
    [plan({ fechaInicio: "2026-07-15" })],
    membership("2020-01-01"),
  );
  const ref = await getReferenciaInactividad(ctx, PACIENTE, CLINIC, HOY);
  assert.equal(ref, "2026-07-15");
  assert.equal(inactividadDias(ref), 0);
});

test("plan iniciado hace 3 días → 3 (< umbral 5, no alerta)", async () => {
  const ctx = makeCtx(
    [plan({ fechaInicio: "2026-07-12" })],
    membership("2020-01-01"),
  );
  const ref = await getReferenciaInactividad(ctx, PACIENTE, CLINIC, HOY);
  assert.equal(inactividadDias(ref), 3);
});

test("plan iniciado hace 6 días → 6 (≥ 5, alerta)", async () => {
  const ctx = makeCtx(
    [plan({ fechaInicio: "2026-07-09" })],
    membership("2020-01-01"),
  );
  const ref = await getReferenciaInactividad(ctx, PACIENTE, CLINIC, HOY);
  assert.equal(inactividadDias(ref), 6);
});

test("fechaInicio retroactiva (10 días) pero alta hace 2 días → 2 (alta manda)", async () => {
  const ctx = makeCtx(
    [plan({ fechaInicio: "2026-07-05" })],
    membership("2026-07-13"),
  );
  const ref = await getReferenciaInactividad(ctx, PACIENTE, CLINIC, HOY);
  assert.equal(ref, "2026-07-13");
  assert.equal(inactividadDias(ref), 2);
});

test("plan antiguo (30 días) sin actividad, ventana 7d → 7 (comportamiento genuino)", async () => {
  const ctx = makeCtx(
    [plan({ fechaInicio: "2026-06-15" })],
    membership("2020-01-01"),
  );
  const ref = await getReferenciaInactividad(ctx, PACIENTE, CLINIC, HOY);
  assert.equal(inactividadDias(ref, 7), 7);
});

test("fechaInicio ausente → usa _creationTime del plan (hace 1 día)", async () => {
  const ctx = makeCtx(
    [plan({ fechaInicio: undefined, _creationTime: ms("2026-07-14") })],
    membership("2020-01-01"),
  );
  const ref = await getReferenciaInactividad(ctx, PACIENTE, CLINIC, HOY);
  assert.equal(ref, "2026-07-14");
  assert.equal(inactividadDias(ref), 1);
});

test("sin plan en curso ni membership → fallback a hoy (0 días)", async () => {
  const ctx = makeCtx([], null);
  const ref = await getReferenciaInactividad(ctx, PACIENTE, CLINIC, HOY);
  assert.equal(ref, HOY);
  assert.equal(inactividadDias(ref), 0);
});

test("varios planes activos → usa el inicio más antiguo (min)", async () => {
  const ctx = makeCtx(
    [
      plan({ _id: "a", fechaInicio: "2026-07-10" }),
      plan({ _id: "b", fechaInicio: "2026-07-05" }),
    ],
    membership("2020-01-01"),
  );
  const ref = await getReferenciaInactividad(ctx, PACIENTE, CLINIC, HOY);
  assert.equal(ref, "2026-07-05");
});

test("plan de otra clínica se ignora", async () => {
  const ctx = makeCtx(
    [plan({ clinicId: "otra", fechaInicio: "2026-07-01" })],
    membership("2026-07-14"),
  );
  const ref = await getReferenciaInactividad(ctx, PACIENTE, CLINIC, HOY);
  // El plan de "otra" no cuenta; solo queda la fecha de alta.
  assert.equal(ref, "2026-07-14");
});

console.log("done.");
