/**
 * Tests unitarios para `syncPatientAggregateValue.ts` (AUDITORIA Bug 3).
 *
 * Mockea el DirectAggregate registrando las llamadas a
 * `replaceOrInsert` / `insertIfDoesNotExist` / `deleteIfExists` y se asegura
 * de que cubrimos el caso `oldVal === newVal` con `insertIfDoesNotExist` —
 * el caso que el sync original dejaba como no-op y producía drift permanente
 * tras una purga externa.
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/syncPatientAggregateValue.test.ts
 */

import { strict as assert } from "node:assert";
import { Id } from "../_generated/dataModel";
import {
  syncPatientAggregateValue,
  type PatientClinicAggregate,
} from "./syncPatientAggregateValue";

type Call =
  | { op: "insertIfDoesNotExist"; key: number; sumValue?: number }
  | {
      op: "replaceOrInsert";
      oldKey: number;
      newKey: number;
      sumValue?: number;
    }
  | { op: "deleteIfExists"; key: number };

function makeAgg() {
  const calls: Call[] = [];
  const agg = {
    insertIfDoesNotExist: async (_ctx: unknown, entry: { key: number; sumValue?: number }) => {
      calls.push({
        op: "insertIfDoesNotExist",
        key: entry.key,
        sumValue: entry.sumValue,
      });
    },
    replaceOrInsert: async (
      _ctx: unknown,
      oldEntry: { key: number },
      newEntry: { key: number; sumValue?: number },
    ) => {
      calls.push({
        op: "replaceOrInsert",
        oldKey: oldEntry.key,
        newKey: newEntry.key,
        sumValue: newEntry.sumValue,
      });
    },
    deleteIfExists: async (_ctx: unknown, entry: { key: number }) => {
      calls.push({ op: "deleteIfExists", key: entry.key });
    },
  } as unknown as PatientClinicAggregate;
  return { agg, calls };
}

const NS: [Id<"clinics">, "15d"] = ["c1" as Id<"clinics">, "15d"];
const PID = "u1" as Id<"users">;

function test(name: string, fn: () => Promise<void>) {
  Promise.resolve(fn()).then(
    () => console.log(`  ✓ ${name}`),
    (err) => {
      console.error(`  ✗ ${name}`);
      console.error(err);
      process.exitCode = 1;
    },
  );
}

console.log("syncPatientAggregateValue.test.ts");

test("oldVal=null, newVal=85 → insertIfDoesNotExist con sumValue", async () => {
  const { agg, calls } = makeAgg();
  await syncPatientAggregateValue(
    {} as never,
    agg,
    NS,
    PID,
    undefined,
    85,
    true,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    op: "insertIfDoesNotExist",
    key: 85,
    sumValue: 85,
  });
});

test("oldVal=85, newVal=85 → insertIfDoesNotExist (idempotente, cubre purga)", async () => {
  const { agg, calls } = makeAgg();
  await syncPatientAggregateValue(
    {} as never,
    agg,
    NS,
    PID,
    85,
    85,
    true,
  );
  // Bug 3 fix: el sync anterior hacía no-op aquí (oldVal === newVal); ahora
  // re-inserta para reconciliar el aggregate si fue purgado externamente.
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    op: "insertIfDoesNotExist",
    key: 85,
    sumValue: 85,
  });
});

test("oldVal=85, newVal=90 → replaceOrInsert", async () => {
  const { agg, calls } = makeAgg();
  await syncPatientAggregateValue(
    {} as never,
    agg,
    NS,
    PID,
    85,
    90,
    true,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    op: "replaceOrInsert",
    oldKey: 85,
    newKey: 90,
    sumValue: 90,
  });
});

test("oldVal=85, newVal=null → deleteIfExists", async () => {
  const { agg, calls } = makeAgg();
  await syncPatientAggregateValue(
    {} as never,
    agg,
    NS,
    PID,
    85,
    undefined,
    true,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { op: "deleteIfExists", key: 85 });
});

test("oldVal=null, newVal=null → no-op", async () => {
  const { agg, calls } = makeAgg();
  await syncPatientAggregateValue(
    {} as never,
    agg,
    NS,
    PID,
    undefined,
    undefined,
    true,
  );
  assert.equal(calls.length, 0);
});

test("withSumValue=false (riskScore) → omite sumValue en insert", async () => {
  const { agg, calls } = makeAgg();
  await syncPatientAggregateValue(
    {} as never,
    agg,
    NS,
    PID,
    undefined,
    42,
    false,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    op: "insertIfDoesNotExist",
    key: 42,
    sumValue: undefined,
  });
});

test("withSumValue=false (riskScore) → omite sumValue en replace", async () => {
  const { agg, calls } = makeAgg();
  await syncPatientAggregateValue(
    {} as never,
    agg,
    NS,
    PID,
    40,
    42,
    false,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    op: "replaceOrInsert",
    oldKey: 40,
    newKey: 42,
    sumValue: undefined,
  });
});
