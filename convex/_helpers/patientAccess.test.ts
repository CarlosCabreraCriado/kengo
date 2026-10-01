/**
 * Tests de `getSharedClinicIdsForPaciente` con un paciente multiclínica.
 *
 * Reproduce el caso real (2026-10): paciente de la clínica A (Motrix) que
 * después se vincula a la clínica B (MYO). El fisio de B debe ver solo lo de
 * B, y nunca fallar por mirar la primera membresía del paciente (A).
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/patientAccess.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";

type MockDoc = { _id: string; [k: string]: unknown };
type IndexQuery = {
  eqs: Array<[string, unknown]>;
  eq(field: string, val: unknown): IndexQuery;
};

function makeIndexQuery(): IndexQuery {
  const q: IndexQuery = {
    eqs: [],
    eq(field, val) {
      q.eqs.push([field, val]);
      return q;
    },
  };
  return q;
}

function makeCtx(tables: Record<string, MockDoc[]>) {
  return {
    db: {
      get: async (id: string) => {
        for (const docs of Object.values(tables)) {
          const found = docs.find((d) => d._id === id);
          if (found) return found;
        }
        return null;
      },
      query: (table: string) => {
        const docs = tables[table] ?? [];
        return {
          withIndex: (_idx: string, build: (q: IndexQuery) => IndexQuery) => {
            const q = build(makeIndexQuery());
            const matches = docs.filter((d) =>
              q.eqs.every(([f, v]) => d[f] === v),
            );
            return {
              unique: async () => (matches.length === 1 ? matches[0] : null),
              collect: async () => matches,
              first: async () => matches[0] ?? null,
            };
          },
        };
      },
    },
  };
}

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function assertThrows(fn: () => Promise<unknown>, msg: string) {
  try {
    await fn();
  } catch (err) {
    if (!(err as Error).message.includes(msg)) {
      throw new Error(
        `Esperaba error con "${msg}", recibí "${(err as Error).message}"`,
      );
    }
    return;
  }
  throw new Error("Esperaba que la función lanzase, no lo hizo");
}

async function load() {
  const mod = await import("./patientAccess");
  return mod as unknown as {
    getSharedClinicIdsForPaciente: (
      ctx: unknown,
      userId: string,
      pacienteId: string,
      clinicId?: string,
    ) => Promise<string[]>;
  };
}

// Paciente en A (membresía más antigua) y en B. Fisio de B, fisio de A, y
// un admin que gestiona C (donde el paciente no está) y B.
const tables = {
  clinicMemberships: [
    { _id: "m1", userId: "paciente", clinicId: "A", puesto: "paciente" },
    { _id: "m2", userId: "paciente", clinicId: "B", puesto: "paciente" },
    { _id: "m3", userId: "fisioA", clinicId: "A", puesto: "fisio" },
    { _id: "m4", userId: "fisioB", clinicId: "B", puesto: "fisio" },
    { _id: "m5", userId: "adminCB", clinicId: "C", puesto: "admin" },
    { _id: "m6", userId: "adminCB", clinicId: "B", puesto: "admin" },
    { _id: "m7", userId: "fisioC", clinicId: "C", puesto: "fisio" },
  ],
};

async function main() {
  const { getSharedClinicIdsForPaciente } = await load();
  const ctx = makeCtx(tables);

  console.log("getSharedClinicIdsForPaciente");

  await test("fisio de B sin clinicId ve solo B (no falla por la membresía A)", async () => {
    assert.deepEqual(
      await getSharedClinicIdsForPaciente(ctx, "fisioB", "paciente"),
      ["B"],
    );
  });

  await test("fisio de B con su clínica activa obtiene B", async () => {
    assert.deepEqual(
      await getSharedClinicIdsForPaciente(ctx, "fisioB", "paciente", "B"),
      ["B"],
    );
  });

  await test("fisio de B no puede pedir la clínica A", async () => {
    await assertThrows(
      () => getSharedClinicIdsForPaciente(ctx, "fisioB", "paciente", "A"),
      "No tienes acceso a esta clínica",
    );
  });

  await test("fisio de A ve solo A", async () => {
    assert.deepEqual(
      await getSharedClinicIdsForPaciente(ctx, "fisioA", "paciente"),
      ["A"],
    );
  });

  await test("admin de C y B ve solo B (el paciente no está en C)", async () => {
    assert.deepEqual(
      await getSharedClinicIdsForPaciente(ctx, "adminCB", "paciente"),
      ["B"],
    );
  });

  await test("admin con clínica activa C donde no está el paciente lanza", async () => {
    await assertThrows(
      () => getSharedClinicIdsForPaciente(ctx, "adminCB", "paciente", "C"),
      "No tienes acceso a este recurso",
    );
  });

  await test("fisio sin clínicas en común lanza", async () => {
    await assertThrows(
      () => getSharedClinicIdsForPaciente(ctx, "fisioC", "paciente"),
      "No tienes acceso a este recurso",
    );
  });
}

void main();
