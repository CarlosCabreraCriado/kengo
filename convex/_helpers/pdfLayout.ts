/**
 * Medición y partición de texto para maquetar PDFs con pdfkit.
 *
 * pdfkit no recorta el texto a su caja: si la caja se dibuja con una altura
 * estimada y el texto ocupa más, se sale por debajo (o pdfkit lo continúa en
 * otra página dejando la caja atrás). Por eso toda caja con texto variable
 * debe medirse ANTES de dibujarse, con la misma fuente, tamaño, ancho y
 * lineGap con que se va a escribir.
 *
 * Solo importa tipos de pdfkit: no arrastra la librería al runtime.
 */
import type PDFDocument from "pdfkit";

type Doc = InstanceType<typeof PDFDocument>;

export interface EstiloTexto {
  font: string;
  size: number;
  width: number;
  lineGap?: number;
}

/** Normaliza saltos de línea y quita blancos sobrantes en los extremos. */
export function normalizarTexto(texto: string | undefined | null): string {
  return (texto ?? "").replace(/\r\n?/g, "\n").trim();
}

/** Aplica fuente y tamaño al documento (estado que usan medición y dibujo). */
export function aplicarEstilo(doc: Doc, estilo: EstiloTexto): void {
  doc.font(estilo.font).fontSize(estilo.size);
}

/** Alto real que ocupará `texto` escrito con `estilo`. Respeta los `\n`. */
export function medirTexto(doc: Doc, texto: string, estilo: EstiloTexto): number {
  if (!texto) return 0;
  aplicarEstilo(doc, estilo);
  return doc.heightOfString(texto, {
    width: estilo.width,
    lineGap: estilo.lineGap ?? 0,
  });
}

/**
 * Parte `texto` en el prefijo más largo que cabe en `alturaMax` y el resto.
 *
 * Corta por espacios en blanco (el blanco del corte se descarta, así que un
 * corte en un salto de párrafo no deja líneas vacías al principio del resto).
 * Si ni la primera palabra cabe, corta por caracteres. Siempre consume al
 * menos un carácter, de modo que un bucle que llame repetidamente con el
 * resto termina aunque `alturaMax` sea minúscula.
 */
export function partirTexto(
  doc: Doc,
  texto: string,
  estilo: EstiloTexto,
  alturaMax: number,
): [cabe: string, resto: string] {
  if (!texto) return ["", ""];
  if (medirTexto(doc, texto, estilo) <= alturaMax) return [texto, ""];

  // Cortes posibles: inicio y fin de cada tramo de espacio en blanco.
  const cortes: Array<{ fin: number; siguiente: number }> = [];
  const re = /\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    if (m.index === 0) continue;
    cortes.push({ fin: m.index, siguiente: m.index + m[0].length });
  }

  const cabePrefijo = (fin: number) =>
    medirTexto(doc, texto.slice(0, fin), estilo) <= alturaMax;

  // Búsqueda binaria del último corte por palabra que cabe.
  let lo = 0;
  let hi = cortes.length - 1;
  let mejor = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cabePrefijo(cortes[mid].fin)) {
      mejor = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (mejor >= 0) {
    const { fin, siguiente } = cortes[mejor];
    return [texto.slice(0, fin), texto.slice(siguiente)];
  }

  // Ni la primera palabra cabe: corte por caracteres dentro de ella.
  const limite = cortes.length > 0 ? cortes[0].fin : texto.length;
  let lc = 1;
  let hc = limite;
  let mejorChar = 1;
  while (lc <= hc) {
    const mid = (lc + hc) >> 1;
    if (cabePrefijo(mid)) {
      mejorChar = mid;
      lc = mid + 1;
    } else {
      hc = mid - 1;
    }
  }
  return [texto.slice(0, mejorChar), texto.slice(mejorChar).trimStart()];
}
