/**
 * Tests unitarios de `pdfLayout.ts` (medición y partición de texto en PDF).
 *
 * Cubre el bug de PDFs de plan donde las descripciones/instrucciones largas
 * se salían de su caja porque la altura se estimaba por nº de caracteres.
 *
 * Cómo correr:
 *   npx tsx convex/_helpers/pdfLayout.test.ts
 *
 * El archivo está excluido del tsconfig de convex (no se despliega).
 */

import { strict as assert } from "node:assert";
import PDFDocument from "pdfkit/js/pdfkit.standalone";
import {
  EstiloTexto,
  medirTexto,
  normalizarTexto,
  partirTexto,
} from "./pdfLayout";

const doc = new PDFDocument({ size: "A4" });
const estilo: EstiloTexto = { font: "Helvetica", size: 9, width: 495, lineGap: 2 };

let pasados = 0;
function test(nombre: string, fn: () => void): void {
  fn();
  pasados++;
  console.log(`✓ ${nombre}`);
}

const parrafo =
  "Realizar el ejercicio con la espalda recta y sin dolor. Si aparece molestia en la rodilla, reducir el rango de movimiento y avisar al fisioterapeuta en la siguiente sesión. ";
const largo = parrafo.repeat(40).trim();

test("medirTexto coincide con heightOfString con la misma fuente", () => {
  doc.font("Helvetica").fontSize(9);
  const esperado = doc.heightOfString(parrafo, { width: 495, lineGap: 2 });
  assert.equal(medirTexto(doc, parrafo, estilo), esperado);
});

test("medirTexto cuenta los saltos de línea", () => {
  const conSaltos = "uno\ndos\ntres\ncuatro\ncinco";
  const sinSaltos = "uno dos tres cuatro cinco";
  const hConSaltos = medirTexto(doc, conSaltos, estilo);
  const hSinSaltos = medirTexto(doc, sinSaltos, estilo);
  assert.ok(hConSaltos > hSinSaltos * 4, `${hConSaltos} vs ${hSinSaltos}`);
});

test("medirTexto de texto vacío es 0", () => {
  assert.equal(medirTexto(doc, "", estilo), 0);
});

test("partirTexto devuelve todo si cabe", () => {
  assert.deepEqual(partirTexto(doc, parrafo.trim(), estilo, 1000), [
    parrafo.trim(),
    "",
  ]);
});

test("partirTexto: el trozo cabe y no se pierde texto", () => {
  const alturaMax = 120;
  const [cabe, resto] = partirTexto(doc, largo, estilo, alturaMax);
  assert.ok(cabe.length > 0 && resto.length > 0);
  assert.ok(medirTexto(doc, cabe, estilo) <= alturaMax);
  // Es el prefijo máximo: con una palabra más ya no cabría.
  const siguientePalabra = resto.split(/\s+/)[0];
  assert.ok(
    medirTexto(doc, `${cabe} ${siguientePalabra}`, estilo) > alturaMax,
  );
  const normaliza = (s: string) => s.replace(/\s+/g, " ");
  assert.equal(normaliza(`${cabe} ${resto}`), normaliza(largo));
});

test("partirTexto repetido reparte un texto largo en trozos que caben", () => {
  const alturaMax = 200;
  const trozos: string[] = [];
  let resto = `${largo}\n\n${largo}`;
  while (resto) {
    const [cabe, siguiente] = partirTexto(doc, resto, estilo, alturaMax);
    assert.ok(medirTexto(doc, cabe, estilo) <= alturaMax);
    trozos.push(cabe);
    resto = siguiente;
    assert.ok(trozos.length < 100, "no termina");
  }
  assert.ok(trozos.length > 2);
});

test("partirTexto no deja el resto empezando por un salto de párrafo", () => {
  const texto = `${"linea\n".repeat(30)}final`;
  const [, resto] = partirTexto(doc, texto, estilo, 60);
  assert.ok(!/^\s/.test(resto));
});

test("partirTexto avanza con una palabra gigante o altura minúscula", () => {
  const palabra = "a".repeat(3000);
  const [cabe, resto] = partirTexto(doc, palabra, estilo, 30);
  assert.ok(cabe.length > 0 && cabe.length < palabra.length);
  assert.equal(cabe + resto, palabra);

  const [cabeMin, restoMin] = partirTexto(doc, "hola mundo", estilo, 0);
  assert.ok(cabeMin.length > 0);
  assert.ok(restoMin.length < "hola mundo".length);
});

test("normalizarTexto unifica \\r\\n y recorta extremos", () => {
  assert.equal(normalizarTexto("  a\r\nb\rc \n"), "a\nb\nc");
  assert.equal(normalizarTexto(undefined), "");
});

console.log(`\n${pasados} tests OK`);
