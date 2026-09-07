/**
 * Tests unitarios para `planChainRepair.ts`.
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/planChainRepair.test.ts
 */

import { strict as assert } from "node:assert";
import { Doc, Id } from "../_generated/dataModel";
import {
  classifyChain,
  computeRestoredPredecessorPatch,
  findHeir,
  repairBrokenChain,
} from "./planChainRepair";

// ─── Fake db mínimo: get / query(...).withIndex(...).collect|unique / patch / insert ───

type Row = Record<string, unknown> & { _id: string };

function makeCtx(tables: Record<string, Row[]>) {
  const data: Record<string, Row[]> = {};
  for (const [t, rows] of Object.entries(tables)) data[t] = rows.map((r) => ({ ...r }));
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; doc: Record<string, unknown> }> = [];

  const findRow = (id: string) => {
    for (const rows of Object.values(data)) {
      const r = rows.find((x) => x._id === id);
      if (r) return r;
    }
    return null;
  };

  const ctx = {
    db: {
      get: async (id: string) => findRow(id),
      query: (table: string) => ({
        withIndex: (_name: string, fn: (q: unknown) => unknown) => {
          const eqs: Array<[string, unknown]> = [];
          const q = {
            eq(field: string, value: unknown) {
              eqs.push([field, value]);
              return q;
            },
          };
          fn(q);
          const rows = (data[table] ?? []).filter((r) =>
            eqs.every(([f, v]) => r[f] === v),
          );
          return {
            collect: async () => rows,
            unique: async () => {
              if (rows.length > 1) throw new Error("unique: >1");
              return rows[0] ?? null;
            },
            first: async () => rows[0] ?? null,
          };
        },
      }),
      patch: async (id: string, patch: Record<string, unknown>) => {
        patches.push({ id, patch });
        const row = findRow(id);
        if (!row) throw new Error(`patch: ${id} no existe`);
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined) delete row[k];
          else row[k] = v;
        }
      },
      insert: async (table: string, doc: Record<string, unknown>) => {
        const _id = `${table}_${(data[table] ?? []).length + 1}`;
        inserts.push({ table, doc });
        (data[table] ??= []).push({ _id, ...doc });
        return _id;
      },
    },
    patches,
    inserts,
    row: findRow,
  };
  return ctx;
}

function plan(p: Partial<Doc<"plans">> & { _id: string }): Doc<"plans"> {
  return {
    _creationTime: 0,
    titulo: "t",
    estado: "activo",
    pacienteId: "u1" as Id<"users">,
    fisioId: "f1" as Id<"users">,
    clinicId: "c1" as Id<"clinics">,
    version: 1,
    ...p,
    _id: p._id as Id<"plans">,
  } as Doc<"plans">;
}

function test(name: string, fn: () => Promise<void> | void) {
  Promise.resolve(fn()).then(
    () => console.log(`  ✓ ${name}`),
    (err) => {
      console.error(`  ✗ ${name}`);
      console.error(err);
      process.exitCode = 1;
    },
  );
}

console.log("planChainRepair.test.ts");

const HOY = "2026-09-07";
const P2 = "p2" as Id<"plans">;

// ─── classifyChain ───

test("classifyChain: plan no modificado → null", () => {
  assert.equal(classifyChain({ estado: "activo", planSucesor: P2 }, null), null);
});

test("classifyChain: cadena sana → null", () => {
  assert.equal(
    classifyChain({ estado: "modificado", planSucesor: P2 }, { estado: "activo" }),
    null,
  );
});

test("classifyChain: modificado sin planSucesor → sin_sucesor", () => {
  assert.equal(classifyChain({ estado: "modificado" }, null), "sin_sucesor");
});

test("classifyChain: sucesor borrado → sucesor_inexistente", () => {
  assert.equal(
    classifyChain({ estado: "modificado", planSucesor: P2 }, null),
    "sucesor_inexistente",
  );
});

test("classifyChain: sucesor cancelado → sucesor_cancelado", () => {
  assert.equal(
    classifyChain(
      { estado: "modificado", planSucesor: P2 },
      { estado: "cancelado" },
    ),
    "sucesor_cancelado",
  );
});

// ─── computeRestoredPredecessorPatch ───

test("restore: fechaFinPreVersion futura → activo con esa fecha", () => {
  const out = computeRestoredPredecessorPatch(
    { fechaInicio: "2026-08-01", fechaFin: "2026-09-06", fechaFinPreVersion: "2026-09-30" },
    HOY,
  );
  assert.equal(out.estado, "activo");
  assert.equal(out.fechaFin, "2026-09-30");
  assert.equal(out.planSucesor, undefined);
  assert.equal(out.fechaFinPreVersion, undefined);
});

test("restore: fechaFinPreVersion pasada → completado", () => {
  const out = computeRestoredPredecessorPatch(
    { fechaInicio: "2026-07-20", fechaFin: "2026-08-23", fechaFinPreVersion: "2026-08-23" },
    HOY,
  );
  assert.equal(out.estado, "completado");
  assert.equal(out.fechaFin, "2026-08-23");
});

test("restore: fechaFinPreVersion null → sin fechaFin y activo", () => {
  const out = computeRestoredPredecessorPatch(
    { fechaInicio: "2026-07-20", fechaFin: "2026-09-06", fechaFinPreVersion: null },
    HOY,
  );
  assert.equal(out.estado, "activo");
  assert.equal(out.fechaFin, undefined);
});

test("restore: legacy (sin fechaFinPreVersion) → conserva la fechaFin truncada", () => {
  const out = computeRestoredPredecessorPatch(
    { fechaInicio: "2026-07-20", fechaFin: "2026-08-23" },
    HOY,
  );
  assert.equal(out.estado, "completado");
  assert.equal(out.fechaFin, "2026-08-23");
});

test("restore: fechaFin === hoy → sigue activo (último día inclusive)", () => {
  const out = computeRestoredPredecessorPatch(
    { fechaInicio: "2026-08-01", fechaFin: "2026-09-06", fechaFinPreVersion: HOY },
    HOY,
  );
  assert.equal(out.estado, "activo");
});

test("restore: fechaFinPreVersion < fechaInicio → piso en fechaInicio", () => {
  const out = computeRestoredPredecessorPatch(
    { fechaInicio: "2026-09-10", fechaFin: "2026-09-10", fechaFinPreVersion: "2026-09-01" },
    HOY,
  );
  assert.equal(out.fechaFin, "2026-09-10");
  assert.equal(out.estado, "activo");
});

// ─── findHeir ───

test("findHeir: encuentra el nieto que apunta al sucesor borrado", async () => {
  const ctx = makeCtx({
    plans: [
      plan({ _id: "p1", estado: "modificado", planSucesor: "pX" as Id<"plans"> }),
      plan({ _id: "p3", estado: "activo", planAnterior: "pX" as Id<"plans"> }),
    ],
  });
  const heir = await findHeir(ctx as never, "u1" as Id<"users">, "pX" as Id<"plans">);
  assert.equal(heir?._id, "p3");
});

test("findHeir: ignora nietos cancelados", async () => {
  const ctx = makeCtx({
    plans: [
      plan({ _id: "p1", estado: "modificado", planSucesor: "pX" as Id<"plans"> }),
      plan({ _id: "p3", estado: "cancelado", planAnterior: "pX" as Id<"plans"> }),
    ],
  });
  const heir = await findHeir(ctx as never, "u1" as Id<"users">, "pX" as Id<"plans">);
  assert.equal(heir, null);
});

test("findHeir: sin candidatos → null", async () => {
  const ctx = makeCtx({ plans: [plan({ _id: "p1", estado: "modificado" })] });
  const heir = await findHeir(ctx as never, "u1" as Id<"users">, "pX" as Id<"plans">);
  assert.equal(heir, null);
});

// ─── repairBrokenChain ───

test("repairBrokenChain: apply=false no escribe nada pero propone", async () => {
  const pred = plan({
    _id: "p1",
    estado: "modificado",
    fechaInicio: "2026-07-20",
    fechaFin: "2026-08-23",
    planSucesor: "pX" as Id<"plans">,
  });
  const ctx = makeCtx({ plans: [pred] });
  const out = await repairBrokenChain(ctx as never, pred, {
    today: HOY,
    motivo: "sucesor_inexistente",
    apply: false,
    migracion: "test",
  });
  assert.equal(out.accion, "restaurado");
  assert.equal(out.despues.estado, "completado");
  assert.equal(out.despues.planSucesor, null);
  assert.equal(ctx.patches.length, 0);
  assert.equal(ctx.inserts.length, 0);
});

test("repairBrokenChain: apply=true restaura, limpia planSucesor y audita", async () => {
  const pred = plan({
    _id: "p1",
    estado: "modificado",
    fechaInicio: "2026-08-01",
    fechaFin: "2026-09-06",
    fechaFinPreVersion: "2026-09-30",
    planSucesor: "pX" as Id<"plans">,
  });
  const ctx = makeCtx({ plans: [pred], dataRepairAudit: [] });
  const out = await repairBrokenChain(ctx as never, pred, {
    today: HOY,
    motivo: "sucesor_inexistente",
    apply: true,
    migracion: "test",
  });
  assert.equal(out.accion, "restaurado");
  const row = ctx.row("p1")!;
  assert.equal(row.estado, "activo");
  assert.equal(row.fechaFin, "2026-09-30");
  assert.equal("planSucesor" in row, false, "planSucesor eliminado");
  assert.equal("fechaFinPreVersion" in row, false, "fechaFinPreVersion eliminado");
  assert.equal(ctx.inserts.length, 1);
  const audit = ctx.inserts[0];
  assert.equal(audit.table, "dataRepairAudit");
  assert.equal(audit.doc.planId, "p1");
  assert.equal(audit.doc.migracion, "test");
  assert.equal(JSON.parse(audit.doc.antes as string).planSucesor, "pX");
  assert.equal(JSON.parse(audit.doc.despues as string).estado, "activo");
});

test("repairBrokenChain: segunda pasada hace upsert de la auditoría (no duplica)", async () => {
  const pred = plan({
    _id: "p1",
    estado: "modificado",
    fechaFin: "2026-08-23",
    planSucesor: "pX" as Id<"plans">,
  });
  const ctx = makeCtx({ plans: [pred], dataRepairAudit: [] });
  const opts = { today: HOY, motivo: "sucesor_inexistente" as const, apply: true, migracion: "test" };
  await repairBrokenChain(ctx as never, pred, opts);
  await repairBrokenChain(ctx as never, ctx.row("p1") as unknown as Doc<"plans">, opts);
  assert.equal(ctx.inserts.length, 1);
});

test("repairBrokenChain: con heredero relinkea sin cambiar el estado", async () => {
  const pred = plan({
    _id: "p1",
    estado: "modificado",
    fechaFin: "2026-08-23",
    planSucesor: "pX" as Id<"plans">,
  });
  const heir = plan({ _id: "p3", estado: "activo", planAnterior: "pX" as Id<"plans"> });
  const ctx = makeCtx({ plans: [pred, heir], dataRepairAudit: [] });
  const out = await repairBrokenChain(ctx as never, pred, {
    today: HOY,
    motivo: "sucesor_inexistente",
    apply: true,
    migracion: "test",
  });
  assert.equal(out.accion, "relinkeado");
  assert.equal(ctx.row("p1")!.estado, "modificado");
  assert.equal(ctx.row("p1")!.planSucesor, "p3");
  assert.equal(ctx.row("p3")!.planAnterior, "p1");
});

test("repairBrokenChain: sucesor cancelado → restaura (no busca heredero)", async () => {
  const pred = plan({
    _id: "p1",
    estado: "modificado",
    fechaFin: "2026-06-30",
    planSucesor: "p2" as Id<"plans">,
  });
  const ctx = makeCtx({
    plans: [pred, plan({ _id: "p2", estado: "cancelado", planAnterior: "p1" as Id<"plans"> })],
    dataRepairAudit: [],
  });
  const out = await repairBrokenChain(ctx as never, pred, {
    today: HOY,
    motivo: "sucesor_cancelado",
    apply: true,
    migracion: "test",
  });
  assert.equal(out.accion, "restaurado");
  assert.equal(ctx.row("p1")!.estado, "completado");
  assert.equal(ctx.row("p2")!.estado, "cancelado", "el sucesor cancelado no se toca");
});
