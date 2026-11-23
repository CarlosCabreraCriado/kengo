"use node";

/**
 * Render del PDF del plan (pdfkit). Sin dependencias de Convex: `actions.ts`
 * obtiene los datos y llama a `buildPdfBuffer`, y los tests/scripts pueden
 * ejecutarlo directamente con tsx.
 *
 * Regla de maquetación: toda caja con texto variable se MIDE antes de
 * dibujarse (`medirTexto`) y, si no cabe en lo que queda de página, el texto
 * se parte (`partirTexto`) y continúa en una caja nueva en la página
 * siguiente. Nunca se estima la altura por número de caracteres.
 */

import PDFDocument from "pdfkit/js/pdfkit.standalone";
import QRCode from "qrcode";
import { PassThrough } from "stream";
import {
  EstiloTexto,
  aplicarEstilo,
  medirTexto,
  normalizarTexto,
  partirTexto,
} from "../_helpers/pdfLayout";

const MARGIN = 40;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 30;
/** Y máxima del contenido: coincide con `page.maxY()` (margen inferior). */
const LIMITE_Y = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;
/** Holgura para que el redondeo no dispare el salto automático de pdfkit. */
const HOLGURA = 1;

type DiaSemana = "L" | "M" | "X" | "J" | "V" | "S" | "D";

export interface EjercicioPdf {
  id: string;
  nombre: string;
  portada?: string;
  series?: number;
  repeticiones?: number;
  duracionSeg?: number;
  descansoSeg?: number;
  diasSemana?: DiaSemana[] | null;
  instruccionesPaciente?: string;
}

export interface PlanPdfData {
  plan: {
    id: string;
    titulo: string;
    descripcion?: string;
    fechaInicio?: string;
    fechaFin?: string;
  };
  ejercicios: EjercicioPdf[];
  clinica: {
    id: string;
    nombre: string;
    direccion?: string;
    telefono?: string;
    email?: string;
    logo?: string;
    colorPrimario?: string;
    colorSecundario?: string;
  };
  paciente: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  fisio: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    numero_colegiado?: string;
  };
  magicLinkUrl: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 37, g: 99, b: 235 };
}

function lightenColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const lighten = (c: number) =>
    Math.min(255, Math.floor(c + (255 - c) * percent));
  return `#${lighten(r).toString(16).padStart(2, "0")}${lighten(g)
    .toString(16)
    .padStart(2, "0")}${lighten(b).toString(16).padStart(2, "0")}`;
}

function formatDate(date: string | undefined): string {
  if (!date) return "No definida";
  // `date` es una fecha CIVIL YYYY-MM-DD: `new Date()` la parsea como
  // medianoche UTC, así que hay que formatear con timeZone UTC EXPLÍCITA.
  // Sin ella dependeríamos de la TZ del contenedor Node (hoy UTC en Railway
  // por defecto; una env var TZ imprimiría un día menos en el PDF).
  const d = new Date(date);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(date: Date): string {
  // Instante real ("Generado: ..."): TZ de referencia explícita en vez de la
  // del contenedor (que imprimía hora UTC como si fuera local).
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

const KNOWN_EXTENSIONS = new Set([
  "webp", "jpg", "jpeg", "png", "avif", "gif", "mp4", "webm", "mov", "pdf",
]);

function ensureExtension(rawKey: string, defaultExt = "webp"): string {
  const lastDot = rawKey.lastIndexOf(".");
  if (lastDot > -1) {
    const candidate = rawKey.slice(lastDot + 1).toLowerCase();
    if (KNOWN_EXTENSIONS.has(candidate)) return rawKey;
  }
  return `${rawKey}.${defaultExt}`;
}

async function fetchAsset(
  key: string,
  transformOptions: Record<string, string | number> = {},
  extension = "webp",
): Promise<ArrayBuffer | null> {
  // ASSETS_URL apunta a Cloudflare R2 (assets.kengoapp.com) servido públicamente.
  // Las keys incluyen extensión (.webp para imágenes, .mp4 para vídeos).
  const assetsUrl = process.env["ASSETS_URL"];
  if (!assetsUrl) return null;

  const base = assetsUrl.replace(/\/$/, "");
  const keyWithExt = ensureExtension(key, extension);

  // Cloudflare Image Transformations: /cdn-cgi/image/<options>/<source>.
  // Forzamos format=png siempre porque pdfkit no soporta WebP/AVIF y no negocia
  // formato vía Accept header.
  const options: Record<string, string | number> = {
    format: "png",
    ...transformOptions,
  };
  const optionsPath = Object.entries(options)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  const url = `${base}/cdn-cgi/image/${optionsPath}/${keyWithExt}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// pdfkit.standalone empaqueta su propio polyfill de Buffer; los Buffer nativos
// de Node no pasan su `Buffer.isBuffer` y caen al fallback `fs.readFileSync`,
// que el shim virtual-fs no implementa. Pasamos siempre el ArrayBuffer
// subyacente para que entre por la rama `src instanceof ArrayBuffer`.
function toArrayBuffer(view: Buffer | Uint8Array): ArrayBuffer {
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength,
  ) as ArrayBuffer;
}

function espacioRestante(doc: PDFKit.PDFDocument): number {
  return LIMITE_Y - doc.y;
}

/** True si estamos al principio de una página (no tiene sentido saltar). */
function enPaginaNueva(doc: PDFKit.PDFDocument): boolean {
  return doc.y <= MARGIN + HOLGURA;
}

function nuevaPagina(doc: PDFKit.PDFDocument): void {
  doc.addPage();
  doc.x = MARGIN;
  doc.y = MARGIN;
}

/** Salta de página si quedan menos de `alto` puntos (y no estamos ya arriba). */
function asegurarEspacio(doc: PDFKit.PDFDocument, alto: number): void {
  if (espacioRestante(doc) < alto && !enPaginaNueva(doc)) nuevaPagina(doc);
}

function escribir(
  doc: PDFKit.PDFDocument,
  texto: string,
  x: number,
  y: number,
  estilo: EstiloTexto,
  color: string,
): void {
  aplicarEstilo(doc, estilo);
  doc.fillColor(color).text(texto, x, y, {
    width: estilo.width,
    lineGap: estilo.lineGap ?? 0,
  });
}

function renderHeader(
  doc: PDFKit.PDFDocument,
  data: PlanPdfData,
  logoBuffer: ArrayBuffer | null,
  colorPrimario: string,
): void {
  const headerHeight = 80;
  const logoStartX = MARGIN;
  const logoY = MARGIN;
  let logoWidth = 0;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, logoStartX, logoY, { height: 45 });
      logoWidth = 55;
    } catch (e) {
      console.warn("No se pudo renderizar el logo:", e);
    }
  }

  doc.fillColor("#1f2937").fontSize(18);
  doc.text(data.clinica.nombre, logoStartX + logoWidth + 10, logoY + 5, {
    width: CONTENT_WIDTH - logoWidth - 20,
  });

  const contactInfo = [
    data.clinica.direccion,
    data.clinica.telefono,
    data.clinica.email,
  ]
    .filter(Boolean)
    .join(" | ");

  doc.fillColor("#6b7280").fontSize(9);
  doc.text(contactInfo, logoStartX + logoWidth + 10, logoY + 30, {
    width: CONTENT_WIDTH - logoWidth - 20,
  });

  doc
    .strokeColor(colorPrimario)
    .lineWidth(2)
    .moveTo(MARGIN, logoY + 55)
    .lineTo(PAGE_WIDTH - MARGIN, logoY + 55)
    .stroke();

  doc.y = headerHeight + 10;
  doc.x = MARGIN;
  doc.fillColor("#000000");
}

function dibujarCaja(
  doc: PDFKit.PDFDocument,
  y: number,
  alto: number,
  radio: number,
  fondo: string,
  borde: string,
): void {
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, alto, radio).fill(fondo);
  doc
    .roundedRect(MARGIN, y, CONTENT_WIDTH, alto, radio)
    .strokeColor(borde)
    .lineWidth(1)
    .stroke();
}

/**
 * Caja de título + periodo + descripción del plan. La altura sale de medir el
 * contenido; si la descripción no cabe en la página, sigue en cajas de
 * continuación (sin título) en las páginas siguientes.
 */
function renderPlanInfoBox(
  doc: PDFKit.PDFDocument,
  data: PlanPdfData,
  colorPrimario: string,
  colorFondo: string,
): void {
  const PAD_X = 15;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 12;
  const GAP = 6;
  const textX = MARGIN + PAD_X;
  const textW = CONTENT_WIDTH - PAD_X * 2;

  const estTitulo: EstiloTexto = { font: "Helvetica-Bold", size: 16, width: textW };
  const estPeriodo: EstiloTexto = { font: "Helvetica", size: 9, width: textW };
  const estDesc: EstiloTexto = { font: "Helvetica", size: 10, width: textW, lineGap: 2 };

  const titulo = data.plan.titulo;
  const periodo = `Periodo: ${formatDate(data.plan.fechaInicio)} - ${formatDate(data.plan.fechaFin)}`;
  const tituloH = medirTexto(doc, titulo, estTitulo);
  const periodoH = medirTexto(doc, periodo, estPeriodo);
  const cabeceraH = PAD_TOP + tituloH + 4 + periodoH;
  const lineaDescH = medirTexto(doc, "X", estDesc);

  let resto = normalizarTexto(data.plan.descripcion);
  let primera = true;

  for (;;) {
    const fijoH = primera ? cabeceraH + (resto ? GAP : 0) : PAD_TOP;
    // Sin sitio ni para la cabecera + una línea: a la página siguiente.
    asegurarEspacio(doc, fijoH + (resto ? lineaDescH : 0) + PAD_BOTTOM);

    const boxY = doc.y;
    const maxDescH = espacioRestante(doc) - fijoH - PAD_BOTTOM - HOLGURA;
    const [cabe, siguiente] = partirTexto(doc, resto, estDesc, maxDescH);
    const descH = medirTexto(doc, cabe, estDesc);
    const boxH = fijoH + descH + PAD_BOTTOM;

    dibujarCaja(doc, boxY, boxH, 8, colorFondo, colorPrimario);

    if (primera) {
      escribir(doc, titulo, textX, boxY + PAD_TOP, estTitulo, "#1f2937");
      escribir(
        doc,
        periodo,
        textX,
        boxY + PAD_TOP + tituloH + 4,
        estPeriodo,
        "#6b7280",
      );
    }
    if (cabe) escribir(doc, cabe, textX, boxY + fijoH, estDesc, "#4b5563");

    doc.x = MARGIN;
    doc.y = boxY + boxH + 15;
    resto = siguiente;
    primera = false;
    if (!resto) break;
    nuevaPagina(doc);
  }

  doc.font("Helvetica");
}

function renderPersonasRow(
  doc: PDFKit.PDFDocument,
  data: PlanPdfData,
): void {
  const boxWidth = (CONTENT_WIDTH - 10) / 2;
  const hasColegiado = !!data.fisio.numero_colegiado;
  const boxHeight = hasColegiado ? 78 : 65;
  // Una sola línea por dato: lo que no cabe se corta con "…" en vez de
  // invadir la caja vecina. Se limita con `height` (con `lineBreak: false`
  // pdfkit sigue partiendo si hay `width`), así que se evalúa después de
  // fijar el tamaño de fuente.
  const unaLinea = () => ({
    width: boxWidth - 24,
    height: doc.currentLineHeight(true),
    ellipsis: true,
  });

  asegurarEspacio(doc, boxHeight);
  const startY = doc.y;

  doc
    .roundedRect(MARGIN, startY, boxWidth, boxHeight, 6)
    .strokeColor("#e5e7eb")
    .lineWidth(1)
    .stroke();

  doc.font("Helvetica-Bold").fillColor("#1f2937").fontSize(10);
  doc.text("PACIENTE", MARGIN + 12, startY + 10);

  doc.font("Helvetica").fillColor("#1f2937").fontSize(11);
  doc.text(
    `${data.paciente.first_name} ${data.paciente.last_name}`,
    MARGIN + 12,
    startY + 26,
    unaLinea(),
  );

  doc.fillColor("#6b7280").fontSize(9);
  doc.text(data.paciente.email, MARGIN + 12, startY + 42, unaLinea());

  const rightBoxX = MARGIN + boxWidth + 10;
  doc
    .roundedRect(rightBoxX, startY, boxWidth, boxHeight, 6)
    .strokeColor("#e5e7eb")
    .lineWidth(1)
    .stroke();

  doc.font("Helvetica-Bold").fillColor("#1f2937").fontSize(10);
  doc.text("FISIOTERAPEUTA", rightBoxX + 12, startY + 10);

  doc.font("Helvetica").fillColor("#1f2937").fontSize(11);
  doc.text(
    `${data.fisio.first_name} ${data.fisio.last_name}`,
    rightBoxX + 12,
    startY + 26,
    unaLinea(),
  );

  doc.fillColor("#6b7280").fontSize(9);
  doc.text(data.fisio.email, rightBoxX + 12, startY + 42, unaLinea());

  if (data.fisio.numero_colegiado) {
    doc.fillColor("#6b7280").fontSize(9);
    doc.text(
      `Nº Colegiado: ${data.fisio.numero_colegiado}`,
      rightBoxX + 12,
      startY + 55,
      unaLinea(),
    );
  }

  doc.x = MARGIN;
  doc.y = startY + boxHeight + 20;
}

// ── Tarjeta de ejercicio ────────────────────────────────────────────────

const IMAGE_SIZE = 55;
const CARD_PAD_BOTTOM = 10;
const CARD_GAP = 8;
const CHIP_H = 16;
const INSTR_X = MARGIN + 10;
const EST_NOMBRE_BASE = { font: "Helvetica", size: 12 } as const;
const EST_CHIP: EstiloTexto = { font: "Helvetica", size: 9, width: CONTENT_WIDTH };
const EST_INSTR_LABEL: EstiloTexto = { font: "Helvetica", size: 8, width: CONTENT_WIDTH - 20 };
const EST_INSTR: EstiloTexto = {
  font: "Helvetica",
  size: 9,
  width: CONTENT_WIDTH - 20,
  lineGap: 2,
};
const ETIQUETA_INSTR = "Instrucciones:";
const ETIQUETA_INSTR_CONT = "Instrucciones (cont.):";

interface ChipLayout {
  texto: string;
  x: number;
  /** Relativa al inicio de la tarjeta. */
  y: number;
  w: number;
}

interface LayoutEjercicio {
  contentX: number;
  estNombre: EstiloTexto;
  chips: ChipLayout[];
  /** Posiciones relativas al inicio de la tarjeta. */
  diasY: number | null;
  estDias: EstiloTexto;
  /** Y (relativa) donde empieza el texto de las instrucciones. */
  instrTextoY: number;
  /** Alto de la tarjeta sin instrucciones. */
  altoSinInstr: number;
}

function detallesEjercicio(ej: EjercicioPdf): string[] {
  const detalles: string[] = [];
  if (ej.series) detalles.push(`${ej.series} series`);
  if (ej.repeticiones) detalles.push(`${ej.repeticiones} reps`);
  if (ej.duracionSeg) detalles.push(`${ej.duracionSeg}s`);
  if (ej.descansoSeg) detalles.push(`${ej.descansoSeg}s descanso`);
  return detalles;
}

function textoDias(ej: EjercicioPdf): string | null {
  return ej.diasSemana && ej.diasSemana.length > 0
    ? `Dias: ${ej.diasSemana.join(", ")}`
    : null;
}

/** Calcula, midiendo, dónde va cada elemento de la tarjeta. */
function calcularLayoutEjercicio(
  doc: PDFKit.PDFDocument,
  ej: EjercicioPdf,
  tieneImagen: boolean,
): LayoutEjercicio {
  const contentX = tieneImagen ? MARGIN + IMAGE_SIZE + 15 : MARGIN + 45;
  const contentW = tieneImagen
    ? CONTENT_WIDTH - IMAGE_SIZE - 30
    : CONTENT_WIDTH - 60;
  const estNombre: EstiloTexto = { ...EST_NOMBRE_BASE, width: contentW };
  const estDias: EstiloTexto = { font: "Helvetica", size: 9, width: contentW };

  const nombreY = 10;
  const nombreH = medirTexto(doc, ej.nombre, estNombre);
  let y = nombreY + nombreH + 4;

  // Chips en filas: si el siguiente no cabe en el ancho, baja de fila.
  aplicarEstilo(doc, EST_CHIP);
  const chips: ChipLayout[] = [];
  let x = contentX;
  for (const texto of detallesEjercicio(ej)) {
    const w = doc.widthOfString(texto) + 10;
    if (x > contentX && x + w > contentX + contentW) {
      x = contentX;
      y += CHIP_H + 4;
    }
    chips.push({ texto, x, y, w });
    x += w + 5;
  }
  let infoBottom = chips.length > 0 ? y + CHIP_H : nombreY + nombreH;

  const dias = textoDias(ej);
  let diasY: number | null = null;
  if (dias) {
    diasY = infoBottom + 4;
    infoBottom = diasY + medirTexto(doc, dias, estDias);
  }

  // Imagen (8 + 55) o círculo con el índice (20 + 12).
  const visualBottom = tieneImagen ? 8 + IMAGE_SIZE : 32;
  const cabeceraBottom = Math.max(visualBottom, infoBottom);
  const instrLabelY = cabeceraBottom + 8;

  return {
    contentX,
    estNombre,
    chips,
    diasY,
    estDias,
    instrTextoY: instrLabelY + 12,
    altoSinInstr: Math.max(
      cabeceraBottom + CARD_PAD_BOTTOM,
      tieneImagen ? IMAGE_SIZE + 30 : 60,
    ),
  };
}

function altoTarjeta(layout: LayoutEjercicio, instrH: number): number {
  return instrH > 0
    ? layout.instrTextoY + instrH + CARD_PAD_BOTTOM
    : layout.altoSinInstr;
}

function renderEjercicioCard(
  doc: PDFKit.PDFDocument,
  ejercicio: EjercicioPdf,
  index: number,
  imageBuffer: ArrayBuffer | null,
  layout: LayoutEjercicio,
  instrucciones: string,
  colorPrimario: string,
  colorSecundario: string,
): void {
  const startY = doc.y;
  const instrH = medirTexto(doc, instrucciones, EST_INSTR);
  const cardHeight = altoTarjeta(layout, instrH);

  doc
    .roundedRect(MARGIN, startY, CONTENT_WIDTH, cardHeight, 6)
    .fillAndStroke("#fafafa", "#e5e7eb");

  if (imageBuffer) {
    const imgX = MARGIN + 8;
    const imgY = startY + 8;
    const borderRadius = 8;

    doc.save();
    doc.roundedRect(imgX, imgY, IMAGE_SIZE, IMAGE_SIZE, borderRadius).clip();
    doc.image(imageBuffer, imgX, imgY, {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      fit: [IMAGE_SIZE, IMAGE_SIZE],
    });
    doc.restore();

    doc
      .roundedRect(imgX, imgY, IMAGE_SIZE, IMAGE_SIZE, borderRadius)
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .stroke();
  } else {
    const circleX = MARGIN + 20;
    const circleY = startY + 20;
    doc.circle(circleX, circleY, 12).fill(colorPrimario);

    doc.font("Helvetica").fillColor("#ffffff").fontSize(11);
    const indexStr = index.toString();
    const indexWidth = doc.widthOfString(indexStr);
    doc.text(indexStr, circleX - indexWidth / 2, circleY - 5, {
      lineBreak: false,
    });
  }

  escribir(
    doc,
    ejercicio.nombre,
    layout.contentX,
    startY + 10,
    layout.estNombre,
    colorSecundario,
  );

  layout.chips.forEach((chip, idx) => {
    const bgColor = idx % 2 === 0 ? "#e0e7ff" : "#dbeafe";
    doc.roundedRect(chip.x, startY + chip.y, chip.w, CHIP_H, 3).fill(bgColor);
    aplicarEstilo(doc, EST_CHIP);
    doc
      .fillColor("#3730a3")
      .text(chip.texto, chip.x + 5, startY + chip.y + 3, { lineBreak: false });
  });

  const dias = textoDias(ejercicio);
  if (dias && layout.diasY !== null) {
    escribir(
      doc,
      dias,
      layout.contentX,
      startY + layout.diasY,
      layout.estDias,
      "#6b7280",
    );
  }

  if (instrucciones) {
    const textoY = startY + layout.instrTextoY;
    escribir(doc, ETIQUETA_INSTR, INSTR_X, textoY - 12, EST_INSTR_LABEL, "#059669");
    escribir(doc, instrucciones, INSTR_X, textoY, EST_INSTR, "#374151");
  }

  doc.x = MARGIN;
  doc.y = startY + cardHeight + CARD_GAP;
}

/** Tarjeta que solo lleva la continuación de unas instrucciones largas. */
function renderInstruccionesContinuacion(
  doc: PDFKit.PDFDocument,
  instrucciones: string,
): void {
  const startY = doc.y;
  const textoY = startY + 10 + 12;
  const cardHeight = 10 + 12 + medirTexto(doc, instrucciones, EST_INSTR) + CARD_PAD_BOTTOM;

  doc
    .roundedRect(MARGIN, startY, CONTENT_WIDTH, cardHeight, 6)
    .fillAndStroke("#fafafa", "#e5e7eb");
  escribir(doc, ETIQUETA_INSTR_CONT, INSTR_X, textoY - 12, EST_INSTR_LABEL, "#059669");
  escribir(doc, instrucciones, INSTR_X, textoY, EST_INSTR, "#374151");

  doc.x = MARGIN;
  doc.y = startY + cardHeight + CARD_GAP;
}

/**
 * Coloca una tarjeta de ejercicio: entera en esta página si cabe, entera en
 * la siguiente si cabe en una página vacía y, si es más alta que una página,
 * partiendo las instrucciones en tarjetas de continuación.
 */
function renderEjercicio(
  doc: PDFKit.PDFDocument,
  ejercicio: EjercicioPdf,
  index: number,
  imageBuffer: ArrayBuffer | null,
  colorPrimario: string,
  colorSecundario: string,
): void {
  const layout = calcularLayoutEjercicio(doc, ejercicio, !!imageBuffer);
  const instrucciones = normalizarTexto(ejercicio.instruccionesPaciente);
  const altoTotal = altoTarjeta(layout, medirTexto(doc, instrucciones, EST_INSTR));
  const altoPaginaVacia = LIMITE_Y - MARGIN;
  const lineaInstrH = medirTexto(doc, "X", EST_INSTR);

  if (altoTotal > espacioRestante(doc) - HOLGURA) {
    const minimoParaPartir = instrucciones
      ? layout.instrTextoY + lineaInstrH * 3 + CARD_PAD_BOTTOM
      : altoTotal;
    if (altoTotal <= altoPaginaVacia || espacioRestante(doc) < minimoParaPartir) {
      asegurarEspacio(doc, Infinity);
    }
  }

  const maxInstrH =
    espacioRestante(doc) - layout.instrTextoY - CARD_PAD_BOTTOM - HOLGURA;
  let [cabe, resto] = partirTexto(doc, instrucciones, EST_INSTR, maxInstrH);
  renderEjercicioCard(
    doc,
    ejercicio,
    index,
    imageBuffer,
    layout,
    cabe,
    colorPrimario,
    colorSecundario,
  );

  while (resto) {
    nuevaPagina(doc);
    const maxH = espacioRestante(doc) - 22 - CARD_PAD_BOTTOM - HOLGURA;
    [cabe, resto] = partirTexto(doc, resto, EST_INSTR, maxH);
    renderInstruccionesContinuacion(doc, cabe);
  }
}

async function renderQRSection(
  doc: PDFKit.PDFDocument,
  magicLinkUrl: string,
  colorPrimario: string,
  colorFondo: string,
): Promise<void> {
  const qrBoxHeight = 160;

  asegurarEspacio(doc, qrBoxHeight);

  const boxY = doc.y;

  dibujarCaja(doc, boxY, qrBoxHeight, 8, colorFondo, colorPrimario);

  const qrBuffer = await QRCode.toBuffer(magicLinkUrl, {
    width: 120,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const qrX = MARGIN + 25;
  const qrY = boxY + 20;
  doc.image(toArrayBuffer(qrBuffer), qrX, qrY, { width: 120 });

  const textX = qrX + 140;

  doc.font("Helvetica-Bold").fillColor("#1f2937").fontSize(14);
  doc.text("Accede a tu plan", textX, boxY + 30, {
    width: CONTENT_WIDTH - 180,
  });

  doc.font("Helvetica").fillColor("#4b5563").fontSize(10);
  doc.text(
    "Escanea el codigo QR con la camara de tu telefono para acceder directamente a tu plan de ejercicios.",
    textX,
    boxY + 55,
    { width: CONTENT_WIDTH - 190, lineGap: 3 },
  );

  doc.fillColor("#6b7280").fontSize(9);
  doc.text("El enlace tiene una validez de 30 dias.", textX, boxY + 110, {
    width: CONTENT_WIDTH - 190,
  });

  doc.roundedRect(textX, boxY + 125, 100, 22, 4).fill(colorPrimario);

  doc.fillColor("#ffffff").fontSize(9);
  doc.text("Escanear QR", textX + 20, boxY + 131, { lineBreak: false });

  doc.fillColor("#000000");
  doc.x = MARGIN;
  doc.y = boxY + qrBoxHeight + 15;
}

function addFooterToAllPages(
  doc: PDFKit.PDFDocument,
  clinicaNombre: string,
): void {
  const pages = doc.bufferedPageRange();
  const footerY = PAGE_HEIGHT - FOOTER_HEIGHT + 10;

  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    const savedBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc
      .rect(0, PAGE_HEIGHT - FOOTER_HEIGHT, PAGE_WIDTH, FOOTER_HEIGHT)
      .fill("#f9fafb");

    doc
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .moveTo(0, PAGE_HEIGHT - FOOTER_HEIGHT)
      .lineTo(PAGE_WIDTH, PAGE_HEIGHT - FOOTER_HEIGHT)
      .stroke();

    doc.font("Helvetica").fillColor("#9ca3af").fontSize(8);
    doc.text(`${clinicaNombre} - Powered by Kengo`, MARGIN, footerY, {
      width: CONTENT_WIDTH / 2,
      align: "left",
      lineBreak: false,
    });

    doc.text(
      `Generado: ${formatDateTime(new Date())} | Pag. ${i + 1}/${pages.count}`,
      PAGE_WIDTH / 2,
      footerY,
      { width: CONTENT_WIDTH / 2, align: "right", lineBreak: false },
    );

    doc.page.margins.bottom = savedBottomMargin;
  }
}

/**
 * Descarta las imágenes que pdfkit no sabe abrir, para que la maquetación
 * (con o sin imagen) se decida antes de dibujar y coincida con lo dibujado.
 */
function imagenValida(
  doc: PDFKit.PDFDocument,
  buffer: ArrayBuffer | null,
): ArrayBuffer | null {
  if (!buffer) return null;
  try {
    // `openImage` existe en pdfkit pero no en @types/pdfkit.
    (doc as unknown as { openImage(src: ArrayBuffer): unknown }).openImage(
      buffer,
    );
    return buffer;
  } catch (e) {
    console.warn("No se pudo cargar imagen de ejercicio:", e);
    return null;
  }
}

export async function buildPdfBuffer(data: PlanPdfData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: MARGIN,
      bottom: MARGIN + FOOTER_HEIGHT,
      left: MARGIN,
      right: MARGIN,
    },
    bufferPages: true,
  });

  const stream = new PassThrough();
  doc.pipe(stream);

  const colorPrimario = data.clinica.colorPrimario || "#2563eb";
  const colorSecundario = data.clinica.colorSecundario || "#1e40af";
  const colorFondoClaro = lightenColor(colorPrimario, 0.92);

  const [logoBuffer, ...ejercicioBuffers] = await Promise.all([
    data.clinica.logo
      ? fetchAsset(data.clinica.logo)
      : Promise.resolve(null),
    ...data.ejercicios.map((ej) =>
      ej.portada
        ? fetchAsset(ej.portada, { width: 110, height: 110, fit: "cover" })
        : Promise.resolve(null),
    ),
  ]);

  renderHeader(doc, data, logoBuffer, colorPrimario);
  renderPlanInfoBox(doc, data, colorPrimario, colorFondoClaro);
  renderPersonasRow(doc, data);

  // Título de sección + al menos el arranque de la primera tarjeta.
  asegurarEspacio(doc, 100);
  doc.font("Helvetica-Bold").fillColor("#1f2937").fontSize(12);
  doc.text("EJERCICIOS DEL PLAN", MARGIN, doc.y);
  doc.moveDown(0.5);

  doc
    .strokeColor(colorPrimario)
    .lineWidth(2)
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + 150, doc.y)
    .stroke();

  doc.font("Helvetica").moveDown(0.8);

  for (let i = 0; i < data.ejercicios.length; i++) {
    renderEjercicio(
      doc,
      data.ejercicios[i],
      i + 1,
      imagenValida(doc, ejercicioBuffers[i] ?? null),
      colorPrimario,
      colorSecundario,
    );
  }

  await renderQRSection(doc, data.magicLinkUrl, colorPrimario, colorFondoClaro);
  addFooterToAllPages(doc, data.clinica.nombre);

  doc.end();

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
