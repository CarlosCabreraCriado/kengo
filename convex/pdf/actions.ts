"use node";

import PDFDocument from "pdfkit/js/pdfkit.standalone";
import QRCode from "qrcode";
import { PassThrough } from "stream";
import { v } from "convex/values";
import { action, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

const MARGIN = 40;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 30;

type DiaSemana = "L" | "M" | "X" | "J" | "V" | "S" | "D";

interface EjercicioPdf {
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

interface PlanPdfData {
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
  const d = new Date(date);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function renderPlanInfoBox(
  doc: PDFKit.PDFDocument,
  data: PlanPdfData,
  colorPrimario: string,
  colorFondo: string,
): void {
  const boxY = doc.y;
  const boxHeight = 75;

  doc
    .roundedRect(MARGIN, boxY, CONTENT_WIDTH, boxHeight, 8)
    .fill(colorFondo);

  doc
    .roundedRect(MARGIN, boxY, CONTENT_WIDTH, boxHeight, 8)
    .strokeColor(colorPrimario)
    .lineWidth(1)
    .stroke();

  doc.font("Helvetica-Bold").fillColor("#1f2937").fontSize(16);
  doc.text(data.plan.titulo, MARGIN + 15, boxY + 12, {
    width: CONTENT_WIDTH - 30,
  });
  doc.font("Helvetica");

  if (data.plan.descripcion) {
    doc.fillColor("#4b5563").fontSize(10);
    doc.text(data.plan.descripcion, MARGIN + 15, boxY + 32, {
      width: CONTENT_WIDTH - 30,
      lineGap: 2,
    });
  }

  const fechaInicio = formatDate(data.plan.fechaInicio);
  const fechaFin = formatDate(data.plan.fechaFin);
  doc.fillColor("#6b7280").fontSize(9);
  doc.text(
    `Periodo: ${fechaInicio} - ${fechaFin}`,
    MARGIN + 15,
    boxY + boxHeight - 18,
    { width: CONTENT_WIDTH - 30 },
  );

  doc.y = boxY + boxHeight + 15;
}

function renderPersonasRow(
  doc: PDFKit.PDFDocument,
  data: PlanPdfData,
): void {
  const startY = doc.y;
  const boxWidth = (CONTENT_WIDTH - 10) / 2;
  const hasColegiado = !!data.fisio.numero_colegiado;
  const boxHeight = hasColegiado ? 78 : 65;

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
  );

  doc.fillColor("#6b7280").fontSize(9);
  doc.text(data.paciente.email, MARGIN + 12, startY + 42, {
    width: boxWidth - 24,
  });

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
  );

  doc.fillColor("#6b7280").fontSize(9);
  doc.text(data.fisio.email, rightBoxX + 12, startY + 42, {
    width: boxWidth - 24,
  });

  if (data.fisio.numero_colegiado) {
    doc.fillColor("#6b7280").fontSize(9);
    doc.text(
      `Nº Colegiado: ${data.fisio.numero_colegiado}`,
      rightBoxX + 12,
      startY + 55,
      { width: boxWidth - 24 },
    );
  }

  doc.y = startY + boxHeight + 20;
}

function calcularAlturaEjercicio(ejercicio: EjercicioPdf): number {
  const IMAGE_HEIGHT = 60;
  let height = ejercicio.portada ? IMAGE_HEIGHT + 20 : 60;
  if (ejercicio.instruccionesPaciente) {
    height += 20 + Math.ceil(ejercicio.instruccionesPaciente.length / 80) * 12;
  }
  return Math.max(height, ejercicio.portada ? IMAGE_HEIGHT + 30 : 60);
}

function renderEjercicioCard(
  doc: PDFKit.PDFDocument,
  ejercicio: EjercicioPdf,
  index: number,
  imageBuffer: ArrayBuffer | null,
  colorPrimario: string,
  colorSecundario: string,
): void {
  const startY = doc.y;
  const cardHeight = calcularAlturaEjercicio(ejercicio);
  const IMAGE_SIZE = 55;

  doc
    .roundedRect(MARGIN, startY, CONTENT_WIDTH, cardHeight, 6)
    .fillAndStroke("#fafafa", "#e5e7eb");

  let imageLoaded = false;
  if (imageBuffer) {
    try {
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

      imageLoaded = true;
    } catch (e) {
      console.warn("No se pudo cargar imagen de ejercicio:", e);
    }
  }

  const contentStartX = imageLoaded
    ? MARGIN + IMAGE_SIZE + 15
    : MARGIN + 45;
  const contentWidth = imageLoaded
    ? CONTENT_WIDTH - IMAGE_SIZE - 30
    : CONTENT_WIDTH - 60;

  if (!imageLoaded) {
    const circleX = MARGIN + 20;
    const circleY = startY + 20;
    doc.circle(circleX, circleY, 12).fill(colorPrimario);

    doc.fillColor("#ffffff").fontSize(11);
    const indexStr = index.toString();
    const indexWidth = doc.widthOfString(indexStr);
    doc.text(indexStr, circleX - indexWidth / 2, circleY - 5, {
      lineBreak: false,
    });
  }

  doc.fillColor(colorSecundario).fontSize(12);
  doc.text(ejercicio.nombre, contentStartX, startY + 10, {
    width: contentWidth,
    continued: false,
  });

  doc.fillColor("#4b5563").fontSize(9);
  const detalles: string[] = [];
  if (ejercicio.series) detalles.push(`${ejercicio.series} series`);
  if (ejercicio.repeticiones) detalles.push(`${ejercicio.repeticiones} reps`);
  if (ejercicio.duracionSeg) detalles.push(`${ejercicio.duracionSeg}s`);
  if (ejercicio.descansoSeg)
    detalles.push(`${ejercicio.descansoSeg}s descanso`);

  let detailX = contentStartX;
  const detailY = startY + 28;

  detalles.forEach((detalle, idx) => {
    const bgColor = idx % 2 === 0 ? "#e0e7ff" : "#dbeafe";
    const textWidth = doc.widthOfString(detalle) + 10;

    doc.roundedRect(detailX, detailY, textWidth, 16, 3).fill(bgColor);
    doc
      .fillColor("#3730a3")
      .fontSize(9)
      .text(detalle, detailX + 5, detailY + 3, { lineBreak: false });
    detailX += textWidth + 5;
  });

  if (ejercicio.diasSemana && ejercicio.diasSemana.length > 0) {
    doc.fillColor("#6b7280").fontSize(9);
    doc.text(
      `Dias: ${ejercicio.diasSemana.join(", ")}`,
      contentStartX,
      detailY + 20,
    );
  }

  if (ejercicio.instruccionesPaciente) {
    const instrY = imageLoaded ? startY + IMAGE_SIZE + 15 : startY + 55;
    doc.fillColor("#059669").fontSize(8);
    doc.text("Instrucciones:", MARGIN + 10, instrY);
    doc.fillColor("#374151").fontSize(9);
    doc.text(ejercicio.instruccionesPaciente, MARGIN + 10, instrY + 12, {
      width: CONTENT_WIDTH - 20,
      lineGap: 2,
    });
  }

  doc.y = startY + cardHeight + 8;
}

async function renderQRSection(
  doc: PDFKit.PDFDocument,
  magicLinkUrl: string,
  colorPrimario: string,
  colorFondo: string,
): Promise<void> {
  const qrBoxHeight = 160;

  if (doc.y + qrBoxHeight > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 20) {
    doc.addPage();
    doc.y = MARGIN;
  }

  const boxY = doc.y;

  doc
    .roundedRect(MARGIN, boxY, CONTENT_WIDTH, qrBoxHeight, 8)
    .fill(colorFondo);

  doc
    .roundedRect(MARGIN, boxY, CONTENT_WIDTH, qrBoxHeight, 8)
    .strokeColor(colorPrimario)
    .lineWidth(1)
    .stroke();

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

async function buildPdfBuffer(data: PlanPdfData): Promise<Buffer> {
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
    const ejercicio = data.ejercicios[i];
    const imageBuffer = ejercicioBuffers[i] ?? null;
    const ejercicioHeight = calcularAlturaEjercicio(ejercicio);

    if (
      doc.y + ejercicioHeight >
      PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 50
    ) {
      doc.addPage();
      doc.y = MARGIN;
    }

    renderEjercicioCard(
      doc,
      ejercicio,
      i + 1,
      imageBuffer,
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

interface PdfGenerationResult {
  storageId: Id<"_storage">;
  url: string | null;
  filename: string;
  data: Awaited<
    ReturnType<
      typeof internal.pdf.internal.getPlanDataForPdf extends any
        ? any
        : any
    >
  >;
}

async function generatePlanPdfInternal(
  ctx: ActionCtx,
  planId: Id<"plans">,
): Promise<{
  storageId: Id<"_storage">;
  url: string | null;
  filename: string;
  paciente: { firstName: string; lastName: string; email: string };
  fisio: { firstName: string; lastName: string };
  plan: { titulo: string };
  clinica: { nombre: string };
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("No autenticado");

  const data = await ctx.runQuery(internal.pdf.internal.getPlanDataForPdf, {
    planId,
    requesterExternalId: identity.subject,
  });

  const tokenResult: { token: string; url: string } = await ctx.runMutation(
    internal.accessTokens.mutations.getOrCreateForUser,
    {
      pacienteId: data.paciente.id as Id<"users">,
      creadoPor: data.requester._id as Id<"users">,
    },
  );

  const fullData: PlanPdfData = {
    plan: data.plan,
    ejercicios: data.ejercicios as EjercicioPdf[],
    clinica: data.clinica,
    paciente: data.paciente,
    fisio: data.fisio,
    magicLinkUrl: tokenResult.url,
  };

  const pdfBuffer = await buildPdfBuffer(fullData);

  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  const storageId = await ctx.storage.store(blob);
  const url = await ctx.storage.getUrl(storageId);

  const lastNameSafe = data.paciente.last_name.replace(/[^\w\-]/g, "_");
  const filename = `plan_${data.plan.id}_${lastNameSafe}.pdf`;

  return {
    storageId,
    url,
    filename,
    paciente: {
      firstName: data.paciente.first_name,
      lastName: data.paciente.last_name,
      email: data.paciente.email,
    },
    fisio: {
      firstName: data.fisio.first_name,
      lastName: data.fisio.last_name,
    },
    plan: { titulo: data.plan.titulo },
    clinica: { nombre: data.clinica.nombre },
  };
}

export const generatePlanPdf = action({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    return await generatePlanPdfInternal(ctx, args.planId);
  },
});

export const generateAndSendPlanPdf = action({
  args: {
    planId: v.id("plans"),
    email: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; url: string | null }> => {
    const result = await generatePlanPdfInternal(ctx, args.planId);

    const sent: boolean = await ctx.runAction(
      internal.email.actions.sendPlanPdfEmail,
      {
        email: args.email,
        storageId: result.storageId,
        filename: result.filename,
        nombrePaciente: `${result.paciente.firstName} ${result.paciente.lastName}`,
        nombreFisio: `${result.fisio.firstName} ${result.fisio.lastName}`,
        tituloPlan: result.plan.titulo,
        nombreClinica: result.clinica.nombre,
      },
    );

    return { ok: sent, url: result.url };
  },
});
