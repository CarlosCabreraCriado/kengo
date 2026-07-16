/**
 * Tests unitarios para `checkClinicPermission`, la primitiva de autorización
 * por puesto en la que se apoyan los fixes de seguridad de la auditoría
 * (S-2 `clinicMemberships.add/remove`, S-4 `users.updatePatient`).
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/permissions.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";

// Mock minimal de ctx.db (mismo estilo que authorization.test.ts): solo
// `.query(table).withIndex(idx, q).unique()` y `ctx.db.get(id)`.
type MockDoc = { _id: string; [k: string]: unknown };
type IndexQuery = { eqs: Array<[string, unknown]>; eq(f: string, v: unknown): IndexQuery };

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
            const matches = docs.filter((d) => q.eqs.every(([f, v]) => d[f] === v));
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

async function assertThrows(fn: () => Promise<unknown>, msg = "") {
  try {
    await fn();
  } catch (err) {
    if (msg && !(err as Error).message.includes(msg)) {
      throw new Error(
        `Esperaba error con "${msg}", recibí "${(err as Error).message}"`,
      );
    }
    return;
  }
  throw new Error("Esperaba que la función lanzase, no lo hizo");
}

async function load() {
  const mod = await import("./permissions");
  return mod as unknown as {
    checkClinicPermission: (
      ctx: unknown,
      userId: string,
      clinicId: string,
      puestos: readonly string[],
    ) => Promise<unknown>;
  };
}

console.log("permissions.test.ts");

// membresías: admin en clínica A, fisio en clínica B.
const memberships: MockDoc[] = [
  { _id: "m1", userId: "adminA", clinicId: "A", puesto: "admin" },
  { _id: "m2", userId: "fisioB", clinicId: "B", puesto: "fisio" },
  { _id: "m3", userId: "pacA", clinicId: "A", puesto: "paciente" },
];

async function run() {
  const { checkClinicPermission } = await load();

  await test("admin de la clínica pasa el check ['admin']", async () => {
    const ctx = makeCtx({ clinicMemberships: memberships });
    const m = (await checkClinicPermission(ctx, "adminA", "A", ["admin"])) as MockDoc;
    assert.equal(m._id, "m1");
  });

  await test("fisio NO pasa el check ['admin']", async () => {
    const ctx = makeCtx({ clinicMemberships: memberships });
    await assertThrows(
      () => checkClinicPermission(ctx, "fisioB", "B", ["admin"]),
      "No tienes permisos",
    );
  });

  await test("no-miembro de la clínica es rechazado (escalada S-2)", async () => {
    const ctx = makeCtx({ clinicMemberships: memberships });
    // adminA no es miembro de la clínica B → no puede operar sobre ella.
    await assertThrows(
      () => checkClinicPermission(ctx, "adminA", "B", ["admin"]),
      "No tienes permisos",
    );
  });

  await test("paciente NO pasa el check ['fisio','admin']", async () => {
    const ctx = makeCtx({ clinicMemberships: memberships });
    await assertThrows(
      () => checkClinicPermission(ctx, "pacA", "A", ["fisio", "admin"]),
      "No tienes permisos",
    );
  });

  if (process.exitCode === 1) {
    console.error("\nFAIL");
  } else {
    console.log("\nOK");
  }
}

void run();
