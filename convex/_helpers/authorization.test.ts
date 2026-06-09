/**
 * Tests unitarios para los helpers de autorización multiclinica.
 *
 * Cubren los escenarios IDOR descritos en la auditoría: usuario de clínica A
 * intentando acceder a recursos de clínica B debe recibir el error
 * "No tienes acceso a este recurso".
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/authorization.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";

// Mock minimal de ctx.db basado en arrays en memoria. Implementa solo el
// subconjunto usado por los helpers: `.query(table).withIndex(idx, q).unique()`
// / `.collect()` y `ctx.db.get(id)`.
type MockDoc = { _id: string; [k: string]: unknown };
type IndexBuilder = (q: IndexQuery) => IndexQuery;
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

function matchesQuery(doc: MockDoc, q: IndexQuery): boolean {
  return q.eqs.every(([f, v]) => doc[f] === v);
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
          withIndex: (_idx: string, build: IndexBuilder) => {
            const q = build(makeIndexQuery());
            const matches = docs.filter((d) => matchesQuery(d, q));
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

// Importar dinámicamente para que el tsc no se queje del ctx tipado.
async function load() {
  const mod = await import("./authorization");
  return mod as unknown as {
    assertCanAccessClinic: (
      ctx: unknown,
      userId: string,
      clinicId: string,
      puestos?: string[],
    ) => Promise<unknown>;
    assertCanAccessPaciente: (
      ctx: unknown,
      userId: string,
      pacienteId: string,
    ) => Promise<void>;
    assertCanAccessPlan: (
      ctx: unknown,
      userId: string,
      planId: string,
    ) => Promise<unknown>;
    assertCanManagePlan: (
      ctx: unknown,
      userId: string,
      planId: string,
    ) => Promise<unknown>;
    assertCanAccessSession: (
      ctx: unknown,
      userId: string,
      sessionId: string,
    ) => Promise<unknown>;
    assertCanAccessRoutine: (
      ctx: unknown,
      userId: string,
      routineId: string,
    ) => Promise<unknown>;
  };
}

(async () => {
  const {
    assertCanAccessClinic,
    assertCanAccessPaciente,
    assertCanAccessPlan,
    assertCanManagePlan,
    assertCanAccessSession,
    assertCanAccessRoutine,
  } = await load();

  console.log("authorization.test.ts");

  await test("assertCanAccessClinic: miembro acepta", async () => {
    const ctx = makeCtx({
      clinicMemberships: [
        { _id: "m1", userId: "u1", clinicId: "c1", puesto: "fisio" },
      ],
    });
    const r = await assertCanAccessClinic(ctx, "u1", "c1");
    assert.equal((r as MockDoc)._id, "m1");
  });

  await test("assertCanAccessClinic: no miembro rechaza", async () => {
    const ctx = makeCtx({
      clinicMemberships: [
        { _id: "m1", userId: "u1", clinicId: "c1", puesto: "fisio" },
      ],
    });
    await assertThrows(
      () => assertCanAccessClinic(ctx, "u1", "c2"),
      "No tienes acceso",
    );
  });

  await test("assertCanAccessClinic: puesto no permitido rechaza", async () => {
    const ctx = makeCtx({
      clinicMemberships: [
        { _id: "m1", userId: "u1", clinicId: "c1", puesto: "paciente" },
      ],
    });
    await assertThrows(
      () => assertCanAccessClinic(ctx, "u1", "c1", ["fisio", "admin"]),
      "No tienes acceso",
    );
  });

  await test("assertCanAccessPaciente: el propio paciente accede", async () => {
    const ctx = makeCtx({ clinicMemberships: [] });
    await assertCanAccessPaciente(ctx, "u1", "u1");
  });

  await test(
    "assertCanAccessPaciente: fisio en clínica compartida accede",
    async () => {
      const ctx = makeCtx({
        clinicMemberships: [
          { _id: "m1", userId: "fisio1", clinicId: "c1", puesto: "fisio" },
          { _id: "m2", userId: "pac1", clinicId: "c1", puesto: "paciente" },
        ],
      });
      await assertCanAccessPaciente(ctx, "fisio1", "pac1");
    },
  );

  await test(
    "assertCanAccessPaciente: fisio de OTRA clínica NO accede (IDOR bloqueado)",
    async () => {
      const ctx = makeCtx({
        clinicMemberships: [
          { _id: "m1", userId: "fisio1", clinicId: "c1", puesto: "fisio" },
          { _id: "m2", userId: "pac1", clinicId: "c2", puesto: "paciente" },
        ],
      });
      await assertThrows(
        () => assertCanAccessPaciente(ctx, "fisio1", "pac1"),
        "No tienes acceso",
      );
    },
  );

  await test(
    "assertCanAccessPaciente: paciente NO accede a otro paciente (IDOR bloqueado)",
    async () => {
      const ctx = makeCtx({
        clinicMemberships: [
          { _id: "m1", userId: "pacA", clinicId: "c1", puesto: "paciente" },
          { _id: "m2", userId: "pacB", clinicId: "c1", puesto: "paciente" },
        ],
      });
      await assertThrows(
        () => assertCanAccessPaciente(ctx, "pacA", "pacB"),
        "No tienes acceso",
      );
    },
  );

  await test(
    "assertCanAccessPlan: fisio de la clínica del plan accede",
    async () => {
      const ctx = makeCtx({
        plans: [
          {
            _id: "p1",
            pacienteId: "pac1",
            fisioId: "fisio1",
            clinicId: "c1",
          },
        ],
        clinicMemberships: [
          { _id: "m1", userId: "fisio1", clinicId: "c1", puesto: "fisio" },
        ],
      });
      await assertCanAccessPlan(ctx, "fisio1", "p1");
    },
  );

  await test(
    "assertCanAccessPlan: fisio de OTRA clínica NO accede (IDOR bloqueado)",
    async () => {
      const ctx = makeCtx({
        plans: [
          {
            _id: "p1",
            pacienteId: "pac1",
            fisioId: "fisio1",
            clinicId: "c1",
          },
        ],
        clinicMemberships: [
          { _id: "m1", userId: "fisio1", clinicId: "c1", puesto: "fisio" },
          { _id: "m2", userId: "fisio2", clinicId: "c2", puesto: "fisio" },
        ],
      });
      await assertThrows(
        () => assertCanAccessPlan(ctx, "fisio2", "p1"),
        "No tienes acceso",
      );
    },
  );

  await test(
    "assertCanAccessPlan: paciente del plan accede si sigue en la clínica",
    async () => {
      const ctx = makeCtx({
        plans: [
          {
            _id: "p1",
            pacienteId: "pac1",
            fisioId: "fisio1",
            clinicId: "c1",
          },
        ],
        clinicMemberships: [
          { _id: "m1", userId: "pac1", clinicId: "c1", puesto: "paciente" },
        ],
      });
      await assertCanAccessPlan(ctx, "pac1", "p1");
    },
  );

  await test(
    "assertCanManagePlan: fisio de la clínica (no creador) SÍ puede gestionar",
    async () => {
      const ctx = makeCtx({
        plans: [
          { _id: "p1", pacienteId: "pac1", fisioId: "fisioA", clinicId: "c1" },
        ],
        clinicMemberships: [
          { _id: "m1", userId: "fisioA", clinicId: "c1", puesto: "fisio" },
          { _id: "m2", userId: "fisioB", clinicId: "c1", puesto: "fisio" },
        ],
      });
      const r = await assertCanManagePlan(ctx, "fisioB", "p1");
      assert.equal((r as MockDoc)._id, "p1");
    },
  );

  await test(
    "assertCanManagePlan: admin de la clínica SÍ puede gestionar",
    async () => {
      const ctx = makeCtx({
        plans: [
          { _id: "p1", pacienteId: "pac1", fisioId: "fisioA", clinicId: "c1" },
        ],
        clinicMemberships: [
          { _id: "m1", userId: "admin1", clinicId: "c1", puesto: "admin" },
        ],
      });
      await assertCanManagePlan(ctx, "admin1", "p1");
    },
  );

  await test(
    "assertCanManagePlan: paciente dueño del plan NO puede gestionar",
    async () => {
      const ctx = makeCtx({
        plans: [
          { _id: "p1", pacienteId: "pac1", fisioId: "fisioA", clinicId: "c1" },
        ],
        clinicMemberships: [
          { _id: "m1", userId: "pac1", clinicId: "c1", puesto: "paciente" },
        ],
      });
      await assertThrows(
        () => assertCanManagePlan(ctx, "pac1", "p1"),
        "No tienes acceso",
      );
    },
  );

  await test(
    "assertCanManagePlan: fisio de OTRA clínica NO puede (IDOR bloqueado)",
    async () => {
      const ctx = makeCtx({
        plans: [
          { _id: "p1", pacienteId: "pac1", fisioId: "fisioA", clinicId: "c1" },
        ],
        clinicMemberships: [
          { _id: "m1", userId: "fisioA", clinicId: "c1", puesto: "fisio" },
          { _id: "m2", userId: "fisioB", clinicId: "c2", puesto: "fisio" },
        ],
      });
      await assertThrows(
        () => assertCanManagePlan(ctx, "fisioB", "p1"),
        "No tienes acceso",
      );
    },
  );

  await test(
    "assertCanManagePlan: plan legado sin clinicId, fisio que gestiona al paciente SÍ",
    async () => {
      const ctx = makeCtx({
        plans: [{ _id: "p1", pacienteId: "pac1", fisioId: "fisioA" }],
        clinicMemberships: [
          { _id: "m1", userId: "fisioB", clinicId: "c1", puesto: "fisio" },
          { _id: "m2", userId: "pac1", clinicId: "c1", puesto: "paciente" },
        ],
      });
      await assertCanManagePlan(ctx, "fisioB", "p1");
    },
  );

  await test(
    "assertCanAccessSession: paciente dueño accede",
    async () => {
      const ctx = makeCtx({
        sessions: [
          { _id: "s1", pacienteId: "pac1", clinicId: "c1" },
        ],
        clinicMemberships: [],
      });
      await assertCanAccessSession(ctx, "pac1", "s1");
    },
  );

  await test(
    "assertCanAccessSession: fisio ajeno NO accede (IDOR bloqueado)",
    async () => {
      const ctx = makeCtx({
        sessions: [
          { _id: "s1", pacienteId: "pac1", clinicId: "c1" },
        ],
        clinicMemberships: [
          { _id: "m1", userId: "fisio2", clinicId: "c2", puesto: "fisio" },
        ],
      });
      await assertThrows(
        () => assertCanAccessSession(ctx, "fisio2", "s1"),
        "No tienes acceso",
      );
    },
  );

  await test(
    "assertCanAccessRoutine: rutina privada solo el autor accede",
    async () => {
      const ctx = makeCtx({
        routines: [
          { _id: "r1", autorId: "fisio1", visibilidad: "privado" },
        ],
        clinicMemberships: [],
      });
      await assertCanAccessRoutine(ctx, "fisio1", "r1");
      await assertThrows(
        () => assertCanAccessRoutine(ctx, "fisio2", "r1"),
        "No tienes acceso",
      );
    },
  );

  await test(
    "assertCanAccessRoutine: rutina de clínica accesible para coworkers",
    async () => {
      const ctx = makeCtx({
        routines: [
          {
            _id: "r1",
            autorId: "fisio1",
            visibilidad: "clinica",
            clinicId: "c1",
          },
        ],
        clinicMemberships: [
          { _id: "m1", userId: "fisio2", clinicId: "c1", puesto: "fisio" },
          { _id: "m2", userId: "fisio3", clinicId: "c2", puesto: "fisio" },
        ],
      });
      await assertCanAccessRoutine(ctx, "fisio2", "r1");
      await assertThrows(
        () => assertCanAccessRoutine(ctx, "fisio3", "r1"),
        "No tienes acceso",
      );
    },
  );

  if (process.exitCode === 1) {
    console.error("\nFAIL");
  } else {
    console.log("\nOK");
  }
})();
