/**
 * Tests unitarios para `_webhookHelpers.ts`.
 *
 * Cómo correr (manual, mientras no haya jest project para `convex/`):
 *   npx tsx convex/billing/_webhookHelpers.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";
import {
  resolveInvoiceSubscriptionId,
  shouldSkipEvent,
  isForeignSubscriptionEvent,
  isOutOfOrderEvent,
  shouldGrantGraceOnPastDue,
} from "./_webhookHelpers";

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

console.log("_webhookHelpers.test.ts");

// --- resolveInvoiceSubscriptionId ---

test("resolveInvoiceSubscriptionId: formato dahlia (parent.subscription_details)", () => {
  const invoice = {
    parent: { subscription_details: { subscription: "sub_dahlia" } },
  };
  assert.equal(resolveInvoiceSubscriptionId(invoice), "sub_dahlia");
});

test("resolveInvoiceSubscriptionId: formato legacy (subscription top-level)", () => {
  assert.equal(
    resolveInvoiceSubscriptionId({ subscription: "sub_legacy" }),
    "sub_legacy",
  );
});

test("resolveInvoiceSubscriptionId: prioriza el formato nuevo sobre el legacy", () => {
  const invoice = {
    subscription: "sub_old",
    parent: { subscription_details: { subscription: "sub_new" } },
  };
  assert.equal(resolveInvoiceSubscriptionId(invoice), "sub_new");
});

test("resolveInvoiceSubscriptionId: sin subscription devuelve undefined", () => {
  assert.equal(
    resolveInvoiceSubscriptionId({ parent: { subscription_details: null } }),
    undefined,
  );
  assert.equal(resolveInvoiceSubscriptionId({ parent: null }), undefined);
  assert.equal(resolveInvoiceSubscriptionId({}), undefined);
  assert.equal(resolveInvoiceSubscriptionId(null), undefined);
  assert.equal(resolveInvoiceSubscriptionId(undefined), undefined);
});

test("resolveInvoiceSubscriptionId: strings vacíos se tratan como ausencia", () => {
  assert.equal(resolveInvoiceSubscriptionId({ subscription: "" }), undefined);
  assert.equal(
    resolveInvoiceSubscriptionId({
      parent: { subscription_details: { subscription: "" } },
    }),
    undefined,
  );
});

// --- shouldSkipEvent ---

test("shouldSkipEvent: sin registro previo → no salta", () => {
  assert.equal(shouldSkipEvent(null), false);
  assert.equal(shouldSkipEvent(undefined), false);
});

test("shouldSkipEvent: registro sin procesar (a medias) → no salta (reintento)", () => {
  assert.equal(shouldSkipEvent({}), false);
  assert.equal(shouldSkipEvent({ processedAt: undefined }), false);
});

test("shouldSkipEvent: registro ya procesado con éxito → salta", () => {
  assert.equal(shouldSkipEvent({ processedAt: 1_700_000_000_000 }), true);
  assert.equal(shouldSkipEvent({ processedAt: 0 }), true);
});

// --- isForeignSubscriptionEvent (H-1) ---

test("isForeignSubscriptionEvent: sub del evento distinta de la local → true", () => {
  assert.equal(isForeignSubscriptionEvent("sub_S2", "sub_S1"), true);
});

test("isForeignSubscriptionEvent: misma sub → false", () => {
  assert.equal(isForeignSubscriptionEvent("sub_S2", "sub_S2"), false);
});

test("isForeignSubscriptionEvent: sin subId local o sin subId de evento → false", () => {
  assert.equal(isForeignSubscriptionEvent(undefined, "sub_S1"), false);
  assert.equal(isForeignSubscriptionEvent("sub_S2", undefined), false);
  assert.equal(isForeignSubscriptionEvent(undefined, undefined), false);
});

// --- isOutOfOrderEvent (H-5) ---

test("isOutOfOrderEvent: evento más antiguo que el último aplicado → true", () => {
  assert.equal(isOutOfOrderEvent(2000, 1000), true);
});

test("isOutOfOrderEvent: evento más nuevo o igual → false (estricto)", () => {
  assert.equal(isOutOfOrderEvent(1000, 2000), false);
  assert.equal(isOutOfOrderEvent(1000, 1000), false);
});

test("isOutOfOrderEvent: sin timestamp previo o sin timestamp de evento → false", () => {
  assert.equal(isOutOfOrderEvent(undefined, 1000), false);
  assert.equal(isOutOfOrderEvent(2000, undefined), false);
});

// --- shouldGrantGraceOnPastDue (H-4 + carrera C-1×H-5) ---

test("shouldGrantGraceOnPastDue: transición desde active/trialing → concede", () => {
  assert.equal(shouldGrantGraceOnPastDue("active", undefined), true);
  assert.equal(shouldGrantGraceOnPastDue("trialing", undefined), true);
});

test("shouldGrantGraceOnPastDue: sin fila previa → concede", () => {
  assert.equal(shouldGrantGraceOnPastDue(undefined, undefined), true);
});

test("shouldGrantGraceOnPastDue: ya past_due con gracia corriendo → NO resetea (H-4)", () => {
  assert.equal(
    shouldGrantGraceOnPastDue("past_due", 1_700_000_000_000),
    false,
  );
});

test("shouldGrantGraceOnPastDue: past_due SIN gracia (payment_failed perdido por ordering) → concede", () => {
  assert.equal(shouldGrantGraceOnPastDue("past_due", undefined), true);
});

test("shouldGrantGraceOnPastDue: desde unpaid (gracia ya agotada, bloqueada por el cron) → NO reabre", () => {
  assert.equal(shouldGrantGraceOnPastDue("unpaid", undefined), false);
  assert.equal(shouldGrantGraceOnPastDue("unpaid", 1_700_000_000_000), false);
});
