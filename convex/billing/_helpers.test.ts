/**
 * Tests unitarios para `_helpers.ts` (tabla de planes pricing v2).
 *
 * Cómo correr (manual, mientras no haya jest project para `convex/`):
 *   npx tsx convex/billing/_helpers.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";
import {
  PLANES,
  LIMITE_FISIOS_AUTOSERVICIO,
  planParaFisios,
  precioParaFisios,
  limitePacientesParaFisios,
  requiereContactoVentas,
  excedeCapBase,
  buildCustomerOwnerPatch,
  ownerEnFecha,
  defaultPaymentMethodDe,
  resumenTarjeta,
  debeMarcarPendiente,
  tierLabel,
  formatEur,
  totalConIgic,
  formatFechaLargaEs,
  buildCheckoutSubmitMessage,
  CHECKOUT_CUSTOM_TEXT_MAX,
} from "./_helpers";

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

console.log("_helpers.test.ts");

// --- tabla de planes ---

test("PLANES: tres planes Lonely/Smart/Medium con precios v2", () => {
  assert.equal(PLANES.length, 3);
  assert.deepEqual(
    PLANES.map((p) => p.nombre),
    ["Lonely", "Smart", "Medium"],
  );
  assert.deepEqual(
    PLANES.map((p) => p.precioBaseEur),
    [89, 249, 449],
  );
  assert.deepEqual(
    PLANES.map((p) => p.precioIlimitadoEur),
    [109, 279, 489],
  );
  assert.deepEqual(
    PLANES.map((p) => p.limitePacientes),
    [150, 300, 500],
  );
});

test("LIMITE_FISIOS_AUTOSERVICIO = 9 (antes 10)", () => {
  assert.equal(LIMITE_FISIOS_AUTOSERVICIO, 9);
});

// --- planParaFisios (fronteras) ---

test("planParaFisios: fronteras de tramo", () => {
  assert.equal(planParaFisios(0), null);
  assert.equal(planParaFisios(1)?.nombre, "Lonely");
  assert.equal(planParaFisios(2)?.nombre, "Smart");
  assert.equal(planParaFisios(4)?.nombre, "Smart");
  assert.equal(planParaFisios(5)?.nombre, "Medium");
  assert.equal(planParaFisios(9)?.nombre, "Medium");
  assert.equal(planParaFisios(10), null); // enterprise
});

// --- precioParaFisios (6 combinaciones + fuera de tramo) ---

test("precioParaFisios: variante base", () => {
  assert.equal(precioParaFisios(1, "base"), 89);
  assert.equal(precioParaFisios(3, "base"), 249);
  assert.equal(precioParaFisios(9, "base"), 449);
});

test("precioParaFisios: variante ilimitada", () => {
  assert.equal(precioParaFisios(1, "ilimitada"), 109);
  assert.equal(precioParaFisios(4, "ilimitada"), 279);
  assert.equal(precioParaFisios(5, "ilimitada"), 489);
});

test("precioParaFisios: fuera de tramo → 0", () => {
  assert.equal(precioParaFisios(0, "base"), 0);
  assert.equal(precioParaFisios(10, "ilimitada"), 0);
});

// --- limitePacientesParaFisios ---

test("limitePacientesParaFisios: base → cap del tramo", () => {
  assert.equal(limitePacientesParaFisios(1, "base"), 150);
  assert.equal(limitePacientesParaFisios(4, "base"), 300);
  assert.equal(limitePacientesParaFisios(9, "base"), 500);
});

test("limitePacientesParaFisios: ilimitada → null (sin cap)", () => {
  assert.equal(limitePacientesParaFisios(1, "ilimitada"), null);
  assert.equal(limitePacientesParaFisios(9, "ilimitada"), null);
});

test("limitePacientesParaFisios: fuera de tramo (enterprise) → null", () => {
  assert.equal(limitePacientesParaFisios(0, "base"), null);
  assert.equal(limitePacientesParaFisios(10, "base"), null);
});

// --- requiereContactoVentas ---

test("requiereContactoVentas: 9 no, 10 sí", () => {
  assert.equal(requiereContactoVentas(9), false);
  assert.equal(requiereContactoVentas(10), true);
});

// --- excedeCapBase ---

test("excedeCapBase: en el límite exacto no excede", () => {
  assert.deepEqual(excedeCapBase(1, 150), { excede: false, limite: 150 });
  assert.deepEqual(excedeCapBase(4, 300), { excede: false, limite: 300 });
  assert.deepEqual(excedeCapBase(9, 500), { excede: false, limite: 500 });
});

test("excedeCapBase: límite + 1 excede", () => {
  assert.deepEqual(excedeCapBase(1, 151), { excede: true, limite: 150 });
  assert.deepEqual(excedeCapBase(2, 301), { excede: true, limite: 300 });
  assert.deepEqual(excedeCapBase(5, 501), { excede: true, limite: 500 });
});

test("excedeCapBase: fuera de tramo (enterprise) → limite null, nunca excede", () => {
  assert.deepEqual(excedeCapBase(10, 9999), { excede: false, limite: null });
  assert.deepEqual(excedeCapBase(0, 9999), { excede: false, limite: null });
});

// --- buildCustomerOwnerPatch ---

const ana = { email: "ana@clinica.es", name: "Ana Pérez" };

test("buildCustomerOwnerPatch: email distinto → solo email si el name no era del anterior", () => {
  assert.deepEqual(
    buildCustomerOwnerPatch(
      { email: "luis@clinica.es", name: "Fisio Centro S.L." },
      ana,
      "Luis Gómez",
    ),
    { email: "ana@clinica.es" },
  );
});

test("buildCustomerOwnerPatch: name = owner anterior → email y name", () => {
  assert.deepEqual(
    buildCustomerOwnerPatch(
      { email: "luis@clinica.es", name: "Luis Gómez" },
      ana,
      "Luis Gómez",
    ),
    { email: "ana@clinica.es", name: "Ana Pérez" },
  );
});

test("buildCustomerOwnerPatch: name vacío → se rellena aunque no haya anterior", () => {
  assert.deepEqual(
    buildCustomerOwnerPatch({ email: "luis@clinica.es", name: null }, ana, undefined),
    { email: "ana@clinica.es", name: "Ana Pérez" },
  );
});

test("buildCustomerOwnerPatch: sin ownerAnteriorNombre y name distinto → solo email", () => {
  assert.deepEqual(
    buildCustomerOwnerPatch(
      { email: "luis@clinica.es", name: "Luis Gómez" },
      ana,
      undefined,
    ),
    { email: "ana@clinica.es" },
  );
});

test("buildCustomerOwnerPatch: nada que cambiar → null (email case-insensitive, espacios)", () => {
  assert.equal(
    buildCustomerOwnerPatch(
      { email: " Ana@Clinica.es ", name: "Ana Pérez " },
      ana,
      "Luis Gómez",
    ),
    null,
  );
});

test("buildCustomerOwnerPatch: mismo email, name del anterior → solo name", () => {
  assert.deepEqual(
    buildCustomerOwnerPatch(
      { email: "ana@clinica.es", name: "Luis Gómez" },
      ana,
      "Luis Gómez",
    ),
    { name: "Ana Pérez" },
  );
});

// --- ownerEnFecha ---

const auditsAB = [
  { fromUserId: "A", toUserId: "B", createdAt: 1000 },
  { fromUserId: "B", toUserId: "C", createdAt: 2000 },
];

test("ownerEnFecha: sin audits → owner actual", () => {
  assert.equal(ownerEnFecha([], "Z", 500), "Z");
});

test("ownerEnFecha: antes de la primera transferencia → fromUserId de esa", () => {
  assert.equal(ownerEnFecha(auditsAB, "C", 500), "A");
});

test("ownerEnFecha: entre dos transferencias → owner intermedio", () => {
  assert.equal(ownerEnFecha(auditsAB, "C", 1500), "B");
});

test("ownerEnFecha: después de la última → owner actual", () => {
  assert.equal(ownerEnFecha(auditsAB, "C", 3000), "C");
});

test("ownerEnFecha: audit sin fromUserId → toUserId del anterior, o actual", () => {
  const audits = [
    { toUserId: "B", createdAt: 1000 },
    { toUserId: "C", createdAt: 2000 },
  ];
  assert.equal(ownerEnFecha(audits, "C", 1500), "B");
  assert.equal(ownerEnFecha(audits, "C", 500), "C");
});

test("ownerEnFecha: no depende del orden de entrada", () => {
  assert.equal(ownerEnFecha([...auditsAB].reverse(), "C", 1500), "B");
});

// --- defaultPaymentMethodDe ---

test("defaultPaymentMethodDe: la subscription manda sobre el customer", () => {
  assert.equal(
    defaultPaymentMethodDe({
      stripeSubscriptionDefaultPaymentMethodId: "pm_sub",
      stripeCustomerDefaultPaymentMethodId: "pm_cus",
    }),
    "pm_sub",
  );
  assert.equal(
    defaultPaymentMethodDe({ stripeCustomerDefaultPaymentMethodId: "pm_cus" }),
    "pm_cus",
  );
  assert.equal(defaultPaymentMethodDe({}), null);
});

// --- resumenTarjeta ---

test("resumenTarjeta: card, sepa y otros", () => {
  assert.deepEqual(
    resumenTarjeta({
      type: "card",
      card: { brand: "visa", last4: "4242", exp_month: 9, exp_year: 2028 },
    }),
    { tipo: "card", marca: "visa", ultimos4: "4242", caducaMes: 9, caducaAnio: 2028 },
  );
  assert.deepEqual(
    resumenTarjeta({ type: "sepa_debit", sepa_debit: { last4: "3000" } }),
    { tipo: "sepa_debit", marca: "SEPA", ultimos4: "3000" },
  );
  assert.deepEqual(resumenTarjeta({ type: "paypal" }), { tipo: "paypal" });
});

// --- debeMarcarPendiente ---

test("debeMarcarPendiente: solo si era la activa y la sub sigue viva", () => {
  assert.equal(
    debeMarcarPendiente({ pmRetirado: "pm_1", defaultActual: "pm_1", estadoLocal: "active" }),
    true,
  );
  assert.equal(
    debeMarcarPendiente({ pmRetirado: "pm_1", defaultActual: "pm_1", estadoLocal: "trialing" }),
    true,
  );
  assert.equal(
    debeMarcarPendiente({ pmRetirado: "pm_1", defaultActual: "pm_2", estadoLocal: "active" }),
    false,
  );
  assert.equal(
    debeMarcarPendiente({ pmRetirado: "pm_1", defaultActual: null, estadoLocal: "active" }),
    false,
  );
  assert.equal(
    debeMarcarPendiente({ pmRetirado: "pm_1", defaultActual: "pm_1", estadoLocal: "canceled" }),
    false,
  );
  assert.equal(
    debeMarcarPendiente({ pmRetirado: "pm_1", defaultActual: "pm_1", estadoLocal: undefined }),
    false,
  );
});

// --- texto del Checkout ---

/** `Intl` usa U+00A0 antes del símbolo de euro; los asserts comparan con espacio normal. */
const norm = (s: string) => s.replace(/\u00a0/g, " ");

test("tierLabel: tramo + variante, a medida y fallback", () => {
  const smart = planParaFisios(3);
  assert.equal(tierLabel(smart, "base", false), "Plan Smart");
  assert.equal(tierLabel(smart, "ilimitada", false), "Plan Smart Ilimitado");
  assert.equal(tierLabel(smart, "base", true), "Plan a medida");
  assert.equal(tierLabel(null, "base", false), "Tu plan Kengo");
});

test("formatEur: entero sin decimales, con céntimos dos decimales y coma", () => {
  assert.equal(norm(formatEur(249)), "249 €");
  assert.equal(norm(formatEur(266.43)), "266,43 €");
  assert.equal(norm(formatEur(1234.5)), "1234,50 €");
});

test("totalConIgic: 7 % redondeado a céntimos", () => {
  assert.equal(totalConIgic(249), 266.43);
  assert.equal(totalConIgic(279), 298.53);
  assert.equal(totalConIgic(89), 95.23);
  assert.equal(totalConIgic(100), 107);
});

// 2026-10-09T22:30:00Z = 00:30 del día 10 en Madrid, 23:30 del día 9 en Canarias.
const TRIAL_END = Date.UTC(2026, 9, 9, 22, 30);

test("formatFechaLargaEs: fecha larga en español en la TZ dada (Madrid por defecto)", () => {
  assert.equal(formatFechaLargaEs(TRIAL_END), "10 de octubre de 2026");
  assert.equal(formatFechaLargaEs(TRIAL_END, "Atlantic/Canary"), "9 de octubre de 2026");
  assert.equal(formatFechaLargaEs(TRIAL_END, "UTC"), "9 de octubre de 2026");
});

test("buildCheckoutSubmitMessage: create_subscription → importe, dos regímenes y cobro hoy", () => {
  const msg = norm(
    buildCheckoutSubmitMessage({
      accion: "create_subscription",
      planLabel: "Plan Smart Ilimitado",
      importeMensualEur: 279,
    }),
  );
  assert.ok(msg.startsWith("Plan Smart Ilimitado: 279 € al mes, sin impuestos."));
  assert.ok(msg.includes("+7 % de IGIC (298,53 € al mes)"));
  assert.ok(msg.includes("inversión del sujeto pasivo"));
  assert.ok(msg.includes("no se cobra nada"));
  assert.ok(msg.includes("hoy mismo"));
  assert.ok(!msg.includes("periodo de prueba"));
});

test("buildCheckoutSubmitMessage: trial con fecha → cobro el día del fin del trial", () => {
  const msg = norm(
    buildCheckoutSubmitMessage({
      accion: "attach_pm_end_trial",
      planLabel: "Plan Lonely",
      importeMensualEur: 89,
      trialEndMs: TRIAL_END,
    }),
  );
  assert.ok(msg.includes("89 € al mes"));
  assert.ok(msg.includes("(95,23 € al mes)"));
  assert.ok(msg.includes("continúa hasta el 10 de octubre de 2026"));
  assert.ok(!msg.includes("hoy mismo"));
});

test("buildCheckoutSubmitMessage: trial sin fecha → 'cuando termine'", () => {
  const msg = buildCheckoutSubmitMessage({
    accion: "attach_pm_end_trial",
    planLabel: "Plan Medium",
    importeMensualEur: 449,
  });
  assert.ok(msg.includes("cuando termine"));
  assert.ok(!msg.includes("hasta el"));
});

test("buildCheckoutSubmitMessage: a medida sin importe → sin cifras", () => {
  const msg = buildCheckoutSubmitMessage({
    accion: "attach_pm_end_trial",
    planLabel: "Plan a medida",
    importeMensualEur: null,
    trialEndMs: TRIAL_END,
  });
  assert.ok(msg.startsWith("Plan a medida: el importe pactado aparecerá en tu factura."));
  assert.ok(!msg.includes("€"));
  assert.ok(!msg.includes("IGIC ("));
  assert.ok(msg.includes("+7 % de IGIC;"));
  assert.ok(msg.includes("10 de octubre de 2026"));
});

test("buildCheckoutSubmitMessage: nunca supera el máximo de Stripe", () => {
  const casos = [
    buildCheckoutSubmitMessage({ accion: "create_subscription", planLabel: "Plan Medium Ilimitado", importeMensualEur: 489 }),
    buildCheckoutSubmitMessage({ accion: "attach_pm_end_trial", planLabel: "Plan Medium Ilimitado", importeMensualEur: 489, trialEndMs: TRIAL_END }),
    buildCheckoutSubmitMessage({ accion: "attach_pm_end_trial", planLabel: "Plan a medida", importeMensualEur: 12345.67, trialEndMs: TRIAL_END }),
    buildCheckoutSubmitMessage({ accion: "create_subscription", planLabel: "X".repeat(2000), importeMensualEur: 1 }),
  ];
  for (const msg of casos) {
    assert.ok(msg.length <= CHECKOUT_CUSTOM_TEXT_MAX, `longitud ${msg.length}`);
  }
  assert.ok(casos[0].length < 700, `mensaje normal demasiado largo: ${casos[0].length}`);
  assert.ok(casos[3].endsWith("…"));
});
