/**
 * Tests de `_leadHelpers.ts` (formulario «Te llamamos» de la landing).
 *
 * Cómo correr (manual, mientras no haya jest project para `convex/`):
 *   npx tsx convex/contact/_leadHelpers.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";
import { esBot, normalizarTelefono, validarLead } from "./_leadHelpers";

const valido = {
  nombre: "  Ana Pérez ",
  clinica: "Fisio Centro",
  numFisios: "2-4",
  ciudad: " Santander ",
  telefono: "+34 600 12 34 56",
  email: "Ana@Ejemplo.com",
  preferenciaContacto: "whatsapp",
  aceptaPrivacidad: true,
  privacidadVersion: "2026-07-29",
};

// Caso feliz: normaliza espacios, email y teléfono.
{
  const r = validarLead(valido);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.lead.nombre, "Ana Pérez");
    assert.equal(r.lead.email, "ana@ejemplo.com");
    assert.equal(r.lead.telefono, "+34600123456");
    assert.equal(r.lead.ciudad, "Santander");
  }
}

// Sin casilla RGPD → rechazo (también si llega como string "true").
assert.equal(validarLead({ ...valido, aceptaPrivacidad: false }).ok, false);
assert.equal(validarLead({ ...valido, aceptaPrivacidad: "true" }).ok, false);
assert.equal(validarLead({ ...valido, privacidadVersion: "" }).ok, false);

// Campos obligatorios y formatos.
assert.equal(validarLead({ ...valido, clinica: "   " }).ok, false);
assert.equal(validarLead({ ...valido, email: "no-es-email" }).ok, false);
assert.equal(validarLead({ ...valido, telefono: "123" }).ok, false);
assert.equal(validarLead({ ...valido, telefono: "600-12-34-56" }).ok, true);

// Valores fuera de lista.
assert.equal(validarLead({ ...valido, numFisios: "3" }).ok, false);
assert.equal(validarLead({ ...valido, ciudad: "" }).ok, false);
assert.equal(validarLead({ ...valido, ciudad: undefined }).ok, false);
assert.equal(validarLead({ ...valido, preferenciaContacto: "fax" }).ok, false);

// Tipos raros no revientan.
assert.equal(validarLead({ ...valido, nombre: 42 }).ok, false);
assert.equal(validarLead({}).ok, false);

// Recorte de textos largos.
{
  const r = validarLead({ ...valido, clinica: "x".repeat(500) });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.lead.clinica.length, 120);
}

// Honeypot.
assert.equal(esBot({ website: "" }), false);
assert.equal(esBot({}), false);
assert.equal(esBot({ website: "http://spam" }), true);

assert.equal(normalizarTelefono("(+34) 600.12.34.56"), "+34600123456");

console.log("✓ _leadHelpers: todos los tests pasan");
