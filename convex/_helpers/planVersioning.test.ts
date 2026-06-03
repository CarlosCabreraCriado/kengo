/**
 * Tests unitarios para `planVersioning.ts`.
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/planVersioning.test.ts
 */

import { strict as assert } from "node:assert";
import { Id } from "../_generated/dataModel";
import { resolveCanonicalPlanId } from "./planVersioning";

type FakePlan = {
  _id: Id<"plans">;
  planSucesor?: Id<"plans">;
};

function makeCtx(plans: FakePlan[]) {
  const byId = new Map<string, FakePlan>();
  for (const p of plans) byId.set(p._id, p);
  let reads = 0;
  return {
    db: {
      get: async (id: Id<"plans">) => {
        reads += 1;
        return byId.get(id) ?? null;
      },
    },
    getReads: () => reads,
  };
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

console.log("planVersioning.test.ts");

test("sin planSucesor → devuelve el mismo id", async () => {
  const ctx = makeCtx([{ _id: "p1" as Id<"plans"> }]);
  const out = await resolveCanonicalPlanId(ctx as never, "p1" as Id<"plans">);
  assert.equal(out, "p1");
});

test("cadena de 1 sucesor → devuelve el sucesor", async () => {
  const ctx = makeCtx([
    { _id: "p1" as Id<"plans">, planSucesor: "p2" as Id<"plans"> },
    { _id: "p2" as Id<"plans"> },
  ]);
  const out = await resolveCanonicalPlanId(ctx as never, "p1" as Id<"plans">);
  assert.equal(out, "p2");
});

test("cadena de 3 sucesores → devuelve el último", async () => {
  const ctx = makeCtx([
    { _id: "p1" as Id<"plans">, planSucesor: "p2" as Id<"plans"> },
    { _id: "p2" as Id<"plans">, planSucesor: "p3" as Id<"plans"> },
    { _id: "p3" as Id<"plans">, planSucesor: "p4" as Id<"plans"> },
    { _id: "p4" as Id<"plans"> },
  ]);
  const out = await resolveCanonicalPlanId(ctx as never, "p1" as Id<"plans">);
  assert.equal(out, "p4");
});

test("ciclo → corta y no cuelga", async () => {
  const ctx = makeCtx([
    { _id: "p1" as Id<"plans">, planSucesor: "p2" as Id<"plans"> },
    { _id: "p2" as Id<"plans">, planSucesor: "p1" as Id<"plans"> },
  ]);
  const out = await resolveCanonicalPlanId(ctx as never, "p1" as Id<"plans">);
  // El algoritmo detecta el ciclo cuando intenta procesar `p1` por segunda
  // vez y sale con el id actual ("p1"). Lo crítico es que termine en tiempo
  // finito y devuelva alguno de los ids del ciclo, no colgar.
  assert.ok(out === "p1" || out === "p2", `id en ciclo, got=${out}`);
});

test("cache evita relecturas para el mismo planId", async () => {
  const ctx = makeCtx([
    { _id: "p1" as Id<"plans">, planSucesor: "p2" as Id<"plans"> },
    { _id: "p2" as Id<"plans"> },
  ]);
  const cache = new Map<Id<"plans">, Id<"plans">>();
  await resolveCanonicalPlanId(ctx as never, "p1" as Id<"plans">, cache);
  const readsAfterFirst = ctx.getReads();
  await resolveCanonicalPlanId(ctx as never, "p1" as Id<"plans">, cache);
  assert.equal(ctx.getReads(), readsAfterFirst, "segunda llamada no relee");
});

test("plan inexistente → devuelve el id de partida", async () => {
  const ctx = makeCtx([]);
  const out = await resolveCanonicalPlanId(
    ctx as never,
    "pX" as Id<"plans">,
  );
  assert.equal(out, "pX");
});
