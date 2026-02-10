import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { PassThrough } from "stream";
import { Response } from "express";
import { PlanPDFData, EjercicioPlan } from "../types/plan";
import "dotenv/config";

const MARGIN = 40;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 30;

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
  return `#${lighten(r).toString(16).padStart(2, "0")}${lighten(g).toString(16).padStart(2, "0")}${lighten(b).toString(16).padStart(2, "0")}`;
}

export async function generatePlanPDF(
  data: PlanPDFData,
  res: Response
): Promise<void> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN + FOOTER_HEIGHT, left: MARGIN, right: MARGIN },
    bufferPages: true,
  });

  doc.pipe(res);

  const colorPrimario = data.clinica.color_primario || "#2563eb";
  const colorSecundario = data.clinica.color_secundario || "#1e40af";
  const colorFondoClaro = lightenColor(colorPrimario, 0.92);

  await renderHeader(doc, data, colorPrimario);
  renderPlanInfoBox(doc, data, colorPrimario, colorFondoClaro);
  renderPersonasRow(doc, data, colorPrimario);
  await renderEjerciciosSection(doc, data, colorPrimario, colorSecundario);
  await renderQRSection(doc, data, colorPrimario, colorFondoClaro);

  addFooterToAllPages(doc, data.clinica.nombre, colorPrimario);

  doc.end();
}

async function renderHeader(
  doc: PDFKit.PDFDocument,
  data: PlanPDFData,
  colorPrimario: string
): Promise<void> {
  const headerHeight = 80;
  const logoStartX = MARGIN;
  const logoY = MARGIN;

  let logoWidth = 0;

  if (data.clinica.logo) {
    try {
      const logoUrl = `${process.env.DIRECTUS_URL}/assets/${data.clinica.logo}`;
      const logoResponse = await fetch(logoUrl, {
        headers: {
          Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
        },
      });
      if (logoResponse.ok) {
        const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
        doc.image(logoBuffer, logoStartX, logoY, { height: 45 });
        logoWidth = 55;
      }
    } catch (e) {
      console.warn("No se pudo cargar el logo:", e);
    }
  }

  doc.fillColor("#1f2937").fontSize(18);
  doc.text(
    data.clinica.nombre,
    logoStartX + logoWidth + 10,
    logoY + 5,
    { width: CONTENT_WIDTH - logoWidth - 20 }
  );

  const contactInfo = [
    data.clinica.direccion,
    data.clinica.telefono,
    data.clinica.email,
  ].filter(Boolean).join(" | ");

  doc.fillColor("#6b7280").fontSize(9);
  doc.text(
    contactInfo,
    logoStartX + logoWidth + 10,
    logoY + 30,
    { width: CONTENT_WIDTH - logoWidth - 20 }
  );

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
  data: PlanPDFData,
  colorPrimario: string,
  colorFondo: string
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

  const fechaInicio = formatDate(data.plan.fecha_inicio);
  const fechaFin = formatDate(data.plan.fecha_fin);
  doc.fillColor("#6b7280").fontSize(9);
  doc.text(
    `Periodo: ${fechaInicio} - ${fechaFin}`,
    MARGIN + 15,
    boxY + boxHeight - 18,
    { width: CONTENT_WIDTH - 30 }
  );

  doc.y = boxY + boxHeight + 15;
}

function renderPersonasRow(
  doc: PDFKit.PDFDocument,
  data: PlanPDFData,
  colorPrimario: string
): void {
  const startY = doc.y;
  const boxWidth = (CONTENT_WIDTH - 10) / 2;
  const boxHeight = 65;

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
    startY + 26
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
    startY + 26
  );

  doc.fillColor("#6b7280").fontSize(9);
  doc.text(data.fisio.email, rightBoxX + 12, startY + 42, {
    width: boxWidth - 24,
  });

  doc.y = startY + boxHeight + 20;
}

async function renderEjerciciosSection(
  doc: PDFKit.PDFDocument,
  data: PlanPDFData,
  colorPrimario: string,
  colorSecundario: string
): Promise<void> {
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
    const ejercicioHeight = calcularAlturaEjercicio(data.ejercicios[i]);

    if (doc.y + ejercicioHeight > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 50) {
      doc.addPage();
      doc.y = MARGIN;
    }

    await renderEjercicioCard(doc, data.ejercicios[i], i + 1, colorPrimario, colorSecundario);
  }
}

function calcularAlturaEjercicio(ejercicio: EjercicioPlan): number {
  const IMAGE_HEIGHT = 60;
  let height = ejercicio.portada ? IMAGE_HEIGHT + 20 : 60;
  if (ejercicio.instrucciones_paciente) {
    height += 20 + Math.ceil(ejercicio.instrucciones_paciente.length / 80) * 12;
  }
  return Math.max(height, ejercicio.portada ? IMAGE_HEIGHT + 30 : 60);
}

async function renderEjercicioCard(
  doc: PDFKit.PDFDocument,
  ejercicio: EjercicioPlan,
  index: number,
  colorPrimario: string,
  colorSecundario: string
): Promise<void> {
  const startY = doc.y;
  const cardHeight = calcularAlturaEjercicio(ejercicio);
  const IMAGE_SIZE = 55;

  doc
    .roundedRect(MARGIN, startY, CONTENT_WIDTH, cardHeight, 6)
    .fillAndStroke("#fafafa", "#e5e7eb");

  let imageLoaded = false;
  if (ejercicio.portada) {
    try {
      const imageUrl = `${process.env.DIRECTUS_URL}/assets/${ejercicio.portada}?format=png&width=110&height=110&fit=cover`;
      const imageResponse = await fetch(imageUrl, {
        headers: {
          Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
        },
      });
      if (imageResponse.ok) {
        const contentType = imageResponse.headers.get("content-type") || "";
        if (contentType.includes("image/png") || contentType.includes("image/jpeg")) {
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
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

          doc.roundedRect(imgX, imgY, IMAGE_SIZE, IMAGE_SIZE, borderRadius)
            .strokeColor("#e5e7eb")
            .lineWidth(1)
            .stroke();

          imageLoaded = true;
        }
      }
    } catch (e) {
      console.warn("No se pudo cargar imagen de ejercicio:", e);
    }
  }

  const contentStartX = imageLoaded ? MARGIN + IMAGE_SIZE + 15 : MARGIN + 45;
  const contentWidth = imageLoaded ? CONTENT_WIDTH - IMAGE_SIZE - 30 : CONTENT_WIDTH - 60;

  if (!imageLoaded) {
    const circleX = MARGIN + 20;
    const circleY = startY + 20;
    doc.circle(circleX, circleY, 12).fill(colorPrimario);

    doc.fillColor("#ffffff").fontSize(11);
    const indexStr = index.toString();
    const indexWidth = doc.widthOfString(indexStr);
    doc.text(indexStr, circleX - indexWidth / 2, circleY - 5, { lineBreak: false });
  }

  doc.fillColor(colorSecundario).fontSize(12);
  doc.text(ejercicio.nombre_ejercicio, contentStartX, startY + 10, {
    width: contentWidth,
    continued: false,
  });

  doc.fillColor("#4b5563").fontSize(9);
  const detalles = [];
  if (ejercicio.series) detalles.push(`${ejercicio.series} series`);
  if (ejercicio.repeticiones) detalles.push(`${ejercicio.repeticiones} reps`);
  if (ejercicio.duracion_seg) detalles.push(`${ejercicio.duracion_seg}s`);
  if (ejercicio.descanso_seg) detalles.push(`${ejercicio.descanso_seg}s descanso`);

  let detailX = contentStartX;
  const detailY = startY + 28;

  detalles.forEach((detalle, idx) => {
    const bgColor = idx % 2 === 0 ? "#e0e7ff" : "#dbeafe";
    const textWidth = doc.widthOfString(detalle) + 10;

    doc.roundedRect(detailX, detailY, textWidth, 16, 3).fill(bgColor);
    doc.fillColor("#3730a3").fontSize(9).text(detalle, detailX + 5, detailY + 3, { lineBreak: false });
    detailX += textWidth + 5;
  });

  if (ejercicio.dias_semana) {
    try {
      const dias =
        typeof ejercicio.dias_semana === "string"
          ? JSON.parse(ejercicio.dias_semana)
          : ejercicio.dias_semana;
      if (Array.isArray(dias) && dias.length > 0) {
        doc.fillColor("#6b7280").fontSize(9);
        doc.text(`Dias: ${dias.join(", ")}`, contentStartX, detailY + 20);
      }
    } catch {
      doc.fillColor("#6b7280").fontSize(9);
      doc.text(`Dias: ${ejercicio.dias_semana}`, contentStartX, detailY + 20);
    }
  }

  if (ejercicio.instrucciones_paciente) {
    const instrY = imageLoaded ? startY + IMAGE_SIZE + 15 : startY + 55;
    doc.fillColor("#059669").fontSize(8);
    doc.text("Instrucciones:", MARGIN + 10, instrY);
    doc.fillColor("#374151").fontSize(9);
    doc.text(ejercicio.instrucciones_paciente, MARGIN + 10, instrY + 12, {
      width: CONTENT_WIDTH - 20,
      lineGap: 2,
    });
  }

  doc.y = startY + cardHeight + 8;
}

async function renderQRSection(
  doc: PDFKit.PDFDocument,
  data: PlanPDFData,
  colorPrimario: string,
  colorFondo: string
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

  const qrBuffer = await QRCode.toBuffer(data.magicLinkUrl, {
    width: 120,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  const qrX = MARGIN + 25;
  const qrY = boxY + 20;
  doc.image(qrBuffer, qrX, qrY, { width: 120 });

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
    { width: CONTENT_WIDTH - 190, lineGap: 3 }
  );

  doc.fillColor("#6b7280").fontSize(9);
  doc.text(
    "El enlace tiene una validez de 30 dias.",
    textX,
    boxY + 110,
    { width: CONTENT_WIDTH - 190 }
  );

  doc
    .roundedRect(textX, boxY + 125, 100, 22, 4)
    .fill(colorPrimario);

  doc.fillColor("#ffffff").fontSize(9);
  doc.text("Escanear QR", textX + 20, boxY + 131, { lineBreak: false });

  doc.fillColor("#000000");
  doc.y = boxY + qrBoxHeight + 15;
}

function addFooterToAllPages(
  doc: PDFKit.PDFDocument,
  clinicaNombre: string,
  _colorPrimario: string
): void {
  const pages = doc.bufferedPageRange();
  const footerY = PAGE_HEIGHT - FOOTER_HEIGHT + 10;

  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

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
    doc.text(
      `${clinicaNombre} - Powered by Kengo`,
      MARGIN,
      footerY,
      { width: CONTENT_WIDTH / 2, align: "left", lineBreak: false }
    );

    doc.text(
      `Generado: ${formatDateTime(new Date())} | Pag. ${i + 1}/${pages.count}`,
      PAGE_WIDTH / 2,
      footerY,
      { width: CONTENT_WIDTH / 2, align: "right", lineBreak: false }
    );
  }
}

function formatDate(date: Date | string | null): string {
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

export async function generatePlanPDFBuffer(data: PlanPDFData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN + FOOTER_HEIGHT, left: MARGIN, right: MARGIN },
    bufferPages: true,
  });

  const stream = new PassThrough();
  doc.pipe(stream);

  const colorPrimario = data.clinica.color_primario || "#2563eb";
  const colorSecundario = data.clinica.color_secundario || "#1e40af";
  const colorFondoClaro = lightenColor(colorPrimario, 0.92);

  await renderHeader(doc, data, colorPrimario);
  renderPlanInfoBox(doc, data, colorPrimario, colorFondoClaro);
  renderPersonasRow(doc, data, colorPrimario);
  await renderEjerciciosSection(doc, data, colorPrimario, colorSecundario);
  await renderQRSection(doc, data, colorPrimario, colorFondoClaro);

  addFooterToAllPages(doc, data.clinica.nombre, colorPrimario);

  doc.end();

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
