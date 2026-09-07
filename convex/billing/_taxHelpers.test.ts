/**
 * Tests unitarios para `_taxHelpers.ts` (régimen fiscal IGIC / inversión).
 *
 * Cómo correr (manual, mientras no haya jest project para `convex/`):
 *   npx tsx convex/billing/_taxHelpers.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";
import {
  FOOTER_INVERSION_SUJETO_PASIVO,
  resolveRegimenFiscal,
  customerTargetFor,
  subscriptionTaxRatesFor,
  buildCustomerRegimenPatch,
  buildSubscriptionRegimenPatch,
  esSubscriptionActualizable,
} from "./_taxHelpers";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

const IGIC = "txr_igic_test";

console.log("resolveRegimenFiscal");

test("Canarias por CP: Las Palmas (35) y Tenerife (38)", () => {
  assert.equal(resolveRegimenFiscal({ country: "ES", postal_code: "35001" }), "igic");
  assert.equal(resolveRegimenFiscal({ country: "ES", postal_code: "38001" }), "igic");
  assert.equal(resolveRegimenFiscal({ country: "es", postal_code: "35660" }), "igic");
});

test("Península y Baleares → inversión", () => {
  assert.equal(resolveRegimenFiscal({ country: "ES", postal_code: "28001" }), "inversion");
  assert.equal(resolveRegimenFiscal({ country: "ES", postal_code: "08001" }), "inversion");
  assert.equal(resolveRegimenFiscal({ country: "ES", postal_code: "07001" }), "inversion");
});

test("Ceuta (51) y Melilla (52) → inversión (decisión de producto)", () => {
  assert.equal(resolveRegimenFiscal({ country: "ES", postal_code: "51001" }), "inversion");
  assert.equal(resolveRegimenFiscal({ country: "ES", postal_code: "52001" }), "inversion");
});

test("Otro país (UE y no-UE) → inversión", () => {
  assert.equal(resolveRegimenFiscal({ country: "FR", postal_code: "75001" }), "inversion");
  assert.equal(resolveRegimenFiscal({ country: "DE" }), "inversion");
  assert.equal(resolveRegimenFiscal({ country: "US", postal_code: "10001" }), "inversion");
});

test("'IC' (código reservado de Canarias) → igic", () => {
  assert.equal(resolveRegimenFiscal({ country: "IC" }), "igic");
});

test("Sin país → desconocido, aunque haya CP", () => {
  assert.equal(resolveRegimenFiscal(null), "desconocido");
  assert.equal(resolveRegimenFiscal(undefined), "desconocido");
  assert.equal(resolveRegimenFiscal({}), "desconocido");
  assert.equal(resolveRegimenFiscal({ country: "", postal_code: "35001" }), "desconocido");
});

test("España sin CP ni state → desconocido", () => {
  assert.equal(resolveRegimenFiscal({ country: "ES" }), "desconocido");
  assert.equal(resolveRegimenFiscal({ country: "ES", postal_code: "", state: "  " }), "desconocido");
});

test("España sin CP: el state decide (canario → igic, otro → inversión)", () => {
  assert.equal(resolveRegimenFiscal({ country: "ES", state: "Las Palmas" }), "igic");
  assert.equal(resolveRegimenFiscal({ country: "ES", state: "Santa Cruz de Tenerife" }), "igic");
  assert.equal(resolveRegimenFiscal({ country: "ES", state: "CN" }), "igic");
  assert.equal(resolveRegimenFiscal({ country: "ES", state: "canarias" }), "igic");
  assert.equal(resolveRegimenFiscal({ country: "ES", state: "Madrid" }), "inversion");
  assert.equal(resolveRegimenFiscal({ country: "ES", state: "Cataluña" }), "inversion");
});

test("El CP manda sobre el state", () => {
  assert.equal(
    resolveRegimenFiscal({ country: "ES", postal_code: "28001", state: "Las Palmas" }),
    "inversion",
  );
  assert.equal(
    resolveRegimenFiscal({ country: "ES", postal_code: "35001", state: "Madrid" }),
    "igic",
  );
});

test("CP con espacios o prefijo ES- se normaliza; CP inválido cae al state", () => {
  assert.equal(resolveRegimenFiscal({ country: "ES", postal_code: " 35 001 " }), "igic");
  assert.equal(resolveRegimenFiscal({ country: "ES", postal_code: "ES-38001" }), "igic");
  assert.equal(resolveRegimenFiscal({ country: "ES", postal_code: "3500" }), "desconocido");
  assert.equal(
    resolveRegimenFiscal({ country: "ES", postal_code: "abc", state: "Tenerife" }),
    "igic",
  );
});

console.log("customerTargetFor / subscriptionTaxRatesFor");

test("inversión → reverse + footer; igic y desconocido → none sin footer", () => {
  assert.deepEqual(customerTargetFor("inversion"), {
    tax_exempt: "reverse",
    footer: FOOTER_INVERSION_SUJETO_PASIVO,
  });
  assert.deepEqual(customerTargetFor("igic"), { tax_exempt: "none", footer: null });
  assert.deepEqual(customerTargetFor("desconocido"), { tax_exempt: "none", footer: null });
});

test("solo igic lleva tax rate", () => {
  assert.deepEqual(subscriptionTaxRatesFor("igic", IGIC), [IGIC]);
  assert.deepEqual(subscriptionTaxRatesFor("inversion", IGIC), []);
  assert.deepEqual(subscriptionTaxRatesFor("desconocido", IGIC), []);
});

console.log("buildCustomerRegimenPatch");

test("customer nuevo (sin tax_exempt ni footer) → inversión escribe ambos", () => {
  assert.deepEqual(buildCustomerRegimenPatch({}, "inversion"), {
    tax_exempt: "reverse",
    invoice_settings: { footer: FOOTER_INVERSION_SUJETO_PASIVO },
  });
});

test("customer nuevo → igic no escribe nada (none es el default de Stripe)", () => {
  assert.equal(buildCustomerRegimenPatch({}, "igic"), null);
  assert.equal(buildCustomerRegimenPatch({ tax_exempt: "none" }, "igic"), null);
});

test("ya alineado → null (idempotencia frente a customer.updated)", () => {
  assert.equal(
    buildCustomerRegimenPatch(
      {
        tax_exempt: "reverse",
        invoice_settings: { footer: FOOTER_INVERSION_SUJETO_PASIVO },
      },
      "inversion",
    ),
    null,
  );
});

test("inversión → igic: quita reverse y retira nuestro footer", () => {
  assert.deepEqual(
    buildCustomerRegimenPatch(
      {
        tax_exempt: "reverse",
        invoice_settings: { footer: FOOTER_INVERSION_SUJETO_PASIVO },
      },
      "igic",
    ),
    { tax_exempt: "none", invoice_settings: { footer: "" } },
  );
});

test("un footer ajeno no se pisa ni se borra", () => {
  const ajeno = "Gracias por confiar en Kengo";
  assert.deepEqual(
    buildCustomerRegimenPatch(
      { tax_exempt: "none", invoice_settings: { footer: ajeno } },
      "inversion",
    ),
    { tax_exempt: "reverse" },
  );
  assert.equal(
    buildCustomerRegimenPatch(
      { tax_exempt: "none", invoice_settings: { footer: ajeno } },
      "igic",
    ),
    null,
  );
});

test("exempt (puesto a mano) se corrige a none/reverse según régimen", () => {
  assert.deepEqual(buildCustomerRegimenPatch({ tax_exempt: "exempt" }, "igic"), {
    tax_exempt: "none",
  });
  assert.deepEqual(buildCustomerRegimenPatch({ tax_exempt: "exempt" }, "inversion"), {
    tax_exempt: "reverse",
    invoice_settings: { footer: FOOTER_INVERSION_SUJETO_PASIVO },
  });
});

console.log("buildSubscriptionRegimenPatch");

test("sub sin tax rates → igic añade el rate", () => {
  assert.deepEqual(buildSubscriptionRegimenPatch({}, "igic", IGIC), {
    default_tax_rates: [IGIC],
  });
});

test("sub con IGIC → igic no escribe", () => {
  assert.equal(
    buildSubscriptionRegimenPatch(
      { default_tax_rates: [{ id: IGIC }], automatic_tax: { enabled: false } },
      "igic",
      IGIC,
    ),
    null,
  );
});

test("sub con IGIC → inversión vacía la lista con ''", () => {
  assert.deepEqual(
    buildSubscriptionRegimenPatch({ default_tax_rates: [{ id: IGIC }] }, "inversion", IGIC),
    { default_tax_rates: "" },
  );
});

test("sub sin tax rates → inversión/desconocido no escribe", () => {
  assert.equal(buildSubscriptionRegimenPatch({}, "inversion", IGIC), null);
  assert.equal(
    buildSubscriptionRegimenPatch({ default_tax_rates: [] }, "desconocido", IGIC),
    null,
  );
});

test("automatic_tax activo (etapa Stripe Tax) se apaga aunque los rates coincidan", () => {
  assert.deepEqual(
    buildSubscriptionRegimenPatch(
      { default_tax_rates: [], automatic_tax: { enabled: true } },
      "inversion",
      IGIC,
    ),
    { automatic_tax: { enabled: false } },
  );
  assert.deepEqual(
    buildSubscriptionRegimenPatch({ automatic_tax: { enabled: true } }, "igic", IGIC),
    { default_tax_rates: [IGIC], automatic_tax: { enabled: false } },
  );
});

test("un rate distinto al nuestro se sustituye", () => {
  assert.deepEqual(
    buildSubscriptionRegimenPatch({ default_tax_rates: [{ id: "txr_otro" }] }, "igic", IGIC),
    { default_tax_rates: [IGIC] },
  );
});

console.log("esSubscriptionActualizable");

test("solo los estados mutables", () => {
  for (const s of ["trialing", "active", "past_due", "unpaid", "incomplete"]) {
    assert.equal(esSubscriptionActualizable(s), true, s);
  }
  for (const s of ["canceled", "incomplete_expired", "paused"]) {
    assert.equal(esSubscriptionActualizable(s), false, s);
  }
});

console.log("\nTodos los tests pasaron ✓");
