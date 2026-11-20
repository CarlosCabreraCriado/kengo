/**
 * Tests de visibilidad por fisio responsable (`fisioScope.ts`).
 *
 * Admins (y el propietario, que siempre es admin) ven toda la clínica; los
 * fisios solo los pacientes de los que son responsables en `assignments`.
 * Los pacientes sin responsable solo los ven los admins.
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/fisioScope.test.ts
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
      query: (table: string) => {
        const docs = tables[table] ?? [];
        return {
          withIndex: (_idx: string, build: (q: IndexQuery) => IndexQuery) => {
            const q = build(makeIndexQuery());
            const matches = docs.filter((d) =>
              q.eqs.every(([f, v]) => d[f] === v),
            );
            const result = {
              unique: async () => (matches.length === 1 ? matches[0] : null),
              collect: async () => matches,
              order: () => result,
            };
            return result;
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

async function load() {
  const mod = await import("./fisioScope");
  return mod as unknown as {
    getPacientesVisiblesEnClinica: (
      ctx: unknown,
      userId: string,
      clinicId: string,
    ) => Promise<Set<string> | null>;
    puedeGestionarPaciente: (
      ctx: unknown,
      userId: string,
      clinicId: string,
      pacienteId: string,
    ) => Promise<boolean>;
    pendingAlertsVisiblesEnClinica: (
      ctx: unknown,
      userId: string,
      clinicId: string,
    ) => Promise<MockDoc[]>;
  };
}

// Clínica A: admin, fisio1 (responsable de p1), fisio2 (responsable de p2),
// p3 sin responsable. fisio1 también es fisio en B, donde es responsable de
// p1 — no debe heredar nada de A en B ni viceversa.
const tables = {
  clinicMemberships: [
    { _id: "m1", userId: "admin", clinicId: "A", puesto: "admin" },
    { _id: "m2", userId: "fisio1", clinicId: "A", puesto: "fisio" },
    { _id: "m3", userId: "fisio2", clinicId: "A", puesto: "fisio" },
    { _id: "m4", userId: "fisio1", clinicId: "B", puesto: "fisio" },
    { _id: "m5", userId: "p1", clinicId: "A", puesto: "paciente" },
    { _id: "m6", userId: "p2", clinicId: "A", puesto: "paciente" },
    { _id: "m7", userId: "p3", clinicId: "A", puesto: "paciente" },
  ],
  assignments: [
    { _id: "a1", pacienteId: "p1", fisioId: "fisio1", clinicId: "A" },
    { _id: "a2", pacienteId: "p2", fisioId: "fisio2", clinicId: "A" },
    { _id: "a3", pacienteId: "p2", fisioId: "fisio1", clinicId: "B" },
  ],
  physioAlerts: [
    { _id: "al1", pacienteId: "p1", clinicId: "A", estado: "pendiente" },
    { _id: "al2", pacienteId: "p2", clinicId: "A", estado: "pendiente" },
    { _id: "al3", pacienteId: "p3", clinicId: "A", estado: "pendiente" },
  ],
};

async function main() {
  const {
    getPacientesVisiblesEnClinica,
    puedeGestionarPaciente,
    pendingAlertsVisiblesEnClinica,
  } = await load();
  const ctx = makeCtx(tables);

  console.log("getPacientesVisiblesEnClinica");

  await test("admin ve toda la clínica (null)", async () => {
    assert.equal(await getPacientesVisiblesEnClinica(ctx, "admin", "A"), null);
  });

  await test("fisio ve solo sus asignados de esa clínica", async () => {
    const visibles = await getPacientesVisiblesEnClinica(ctx, "fisio1", "A");
    assert.deepEqual([...(visibles ?? [])], ["p1"]);
  });

  await test("las asignaciones no se cruzan entre clínicas", async () => {
    const visibles = await getPacientesVisiblesEnClinica(ctx, "fisio1", "B");
    assert.deepEqual([...(visibles ?? [])], ["p2"]);
  });

  await test("sin membresía de gestión → Set vacío", async () => {
    const visibles = await getPacientesVisiblesEnClinica(ctx, "p1", "A");
    assert.equal(visibles?.size, 0);
  });

  console.log("puedeGestionarPaciente");

  await test("responsable puede", async () => {
    assert.equal(await puedeGestionarPaciente(ctx, "fisio1", "A", "p1"), true);
  });

  await test("otro fisio no puede", async () => {
    assert.equal(await puedeGestionarPaciente(ctx, "fisio2", "A", "p1"), false);
  });

  await test("admin puede, incluso sin responsable", async () => {
    assert.equal(await puedeGestionarPaciente(ctx, "admin", "A", "p3"), true);
  });

  console.log("pendingAlertsVisiblesEnClinica");

  await test("admin ve las 3 alertas", async () => {
    const alerts = await pendingAlertsVisiblesEnClinica(ctx, "admin", "A");
    assert.deepEqual(alerts.map((a) => a._id).sort(), ["al1", "al2", "al3"]);
  });

  await test("fisio solo ve la de su paciente; sin responsable no aparece", async () => {
    const alerts = await pendingAlertsVisiblesEnClinica(ctx, "fisio1", "A");
    assert.deepEqual(alerts.map((a) => a._id), ["al1"]);
  });
}

void main();
