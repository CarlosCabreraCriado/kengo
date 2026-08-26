/**
 * Tests unitarios para el techo de asientos facturables de `capacity.ts`.
 *
 * Cubre la regla nueva: el tope deja de ser una constante global y pasa a
 * salir de `clinicBilling.limiteFisios`, que escribe el webhook de Stripe con
 * las plazas que ventas pacta en el Dashboard.
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/capacity.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";

// Mock minimal de ctx.db (mismo estilo que permissions.test.ts).
type MockDoc = { _id: string; [k: string]: unknown };
type IndexQuery = {
  eqs: Array<[string, unknown]>;
  eq(f: string, v: unknown): IndexQuery;
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

/** Devuelve el `code` del ConvexError lanzado, o null si no lanzó. */
async function codigoDelError(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    const data = (err as { data?: { code?: string } }).data;
    return data?.code ?? "SIN_CODIGO";
  }
}

const CLINIC = "clinic1";

/** `n` membresías facturables (fisio) en la clínica de pruebas. */
function fisios(n: number): MockDoc[] {
  return Array.from({ length: n }, (_, i) => ({
    _id: `m${i}`,
    clinicId: CLINIC,
    userId: `u${i}`,
    puesto: "fisio",
  }));
}

function billing(extra: Record<string, unknown>): MockDoc[] {
  return [{ _id: "b1", clinicId: CLINIC, estadoLocal: "active", ...extra }];
}

async function load() {
  const mod = await import("./capacity");
  return mod as unknown as {
    limiteFisiosDeClinica: (
      ctx: unknown,
      clinicId: string,
    ) => Promise<{ limite: number; esAMedida: boolean }>;
    excedeCapacidadFisios: (ctx: unknown, clinicId: string) => Promise<boolean>;
    assertCapacidadFisios: (ctx: unknown, clinicId: string) => Promise<void>;
    checkCapacidadPacientes: (
      ctx: unknown,
      clinicId: string,
    ) => Promise<{ excede: boolean; limite: number | null; pacientes: number }>;
  };
}

async function main() {
  const {
    limiteFisiosDeClinica,
    excedeCapacidadFisios,
    assertCapacidadFisios,
    checkCapacidadPacientes,
  } = await load();

  console.log("\ncapacity.ts — techo de asientos facturables\n");

  // --- limiteFisiosDeClinica ---

  await test("sin fila clinicBilling → tope de autoservicio (9)", async () => {
    const ctx = makeCtx({ clinicMemberships: [], clinicBilling: [] });
    assert.deepEqual(await limiteFisiosDeClinica(ctx, CLINIC), {
      limite: 9,
      esAMedida: false,
    });
  });

  await test("billing sin limiteFisios → tope de autoservicio (9)", async () => {
    const ctx = makeCtx({
      clinicMemberships: [],
      clinicBilling: billing({ variante: "base" }),
    });
    assert.deepEqual(await limiteFisiosDeClinica(ctx, CLINIC), {
      limite: 9,
      esAMedida: false,
    });
  });

  await test("limiteFisios presente → ese valor y esAMedida", async () => {
    const ctx = makeCtx({
      clinicMemberships: [],
      clinicBilling: billing({ limiteFisios: 15 }),
    });
    assert.deepEqual(await limiteFisiosDeClinica(ctx, CLINIC), {
      limite: 15,
      esAMedida: true,
    });
  });

  // --- excedeCapacidadFisios / assertCapacidadFisios ---

  await test("autoservicio: el 9º asiento entra, el 10º no", async () => {
    const con8 = makeCtx({ clinicMemberships: fisios(8), clinicBilling: [] });
    assert.equal(await excedeCapacidadFisios(con8, CLINIC), false);

    const con9 = makeCtx({ clinicMemberships: fisios(9), clinicBilling: [] });
    assert.equal(await excedeCapacidadFisios(con9, CLINIC), true);
    assert.equal(
      await codigoDelError(() => assertCapacidadFisios(con9, CLINIC)),
      "REQUIERE_CONTACTO_VENTAS",
    );
  });

  await test("contrato de 15 plazas: el 10º asiento ya entra", async () => {
    const ctx = makeCtx({
      clinicMemberships: fisios(9),
      clinicBilling: billing({ limiteFisios: 15 }),
    });
    assert.equal(await excedeCapacidadFisios(ctx, CLINIC), false);
    assert.equal(
      await codigoDelError(() => assertCapacidadFisios(ctx, CLINIC)),
      null,
    );
  });

  await test("contrato de 15 plazas: el 16º no, y con código propio", async () => {
    const ctx = makeCtx({
      clinicMemberships: fisios(15),
      clinicBilling: billing({ limiteFisios: 15 }),
    });
    assert.equal(await excedeCapacidadFisios(ctx, CLINIC), true);
    assert.equal(
      await codigoDelError(() => assertCapacidadFisios(ctx, CLINIC)),
      "PLAZAS_AGOTADAS",
    );
  });

  await test("contrato por debajo del autoservicio (3 plazas) también manda", async () => {
    // Un enterprise puede pactar MENOS de 9: el contrato gana al tope global.
    const ctx = makeCtx({
      clinicMemberships: fisios(3),
      clinicBilling: billing({ limiteFisios: 3 }),
    });
    assert.equal(await excedeCapacidadFisios(ctx, CLINIC), true);
    assert.equal(
      await codigoDelError(() => assertCapacidadFisios(ctx, CLINIC)),
      "PLAZAS_AGOTADAS",
    );
  });

  await test("los pacientes no ocupan asiento facturable", async () => {
    const ctx = makeCtx({
      clinicMemberships: [
        ...fisios(9),
        { _id: "p1", clinicId: CLINIC, userId: "up1", puesto: "paciente" },
      ],
      clinicBilling: billing({ limiteFisios: 12 }),
    });
    assert.equal(await excedeCapacidadFisios(ctx, CLINIC), false);
  });

  // --- cap de pacientes ---

  await test("contrato a medida → sin cap de pacientes", async () => {
    const ctx = makeCtx({
      clinicMemberships: [
        ...fisios(12),
        ...Array.from({ length: 900 }, (_, i) => ({
          _id: `p${i}`,
          clinicId: CLINIC,
          userId: `up${i}`,
          puesto: "paciente",
        })),
      ],
      clinicBilling: billing({ limiteFisios: 15, variante: "base" }),
    });
    const res = await checkCapacidadPacientes(ctx, CLINIC);
    assert.equal(res.limite, null);
    assert.equal(res.excede, false);
  });

  await test("autoservicio base sigue con su cap por tramo", async () => {
    const ctx = makeCtx({
      clinicMemberships: [
        ...fisios(1),
        ...Array.from({ length: 150 }, (_, i) => ({
          _id: `p${i}`,
          clinicId: CLINIC,
          userId: `up${i}`,
          puesto: "paciente",
        })),
      ],
      clinicBilling: billing({ variante: "base" }),
    });
    const res = await checkCapacidadPacientes(ctx, CLINIC);
    assert.equal(res.limite, 150);
    assert.equal(res.excede, true);
  });
}

void main();
