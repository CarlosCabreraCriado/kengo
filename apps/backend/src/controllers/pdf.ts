import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import Planes from "../models/planes";
import { getUserById, getTokensUsuario, createTokenAccesoUsuario } from "../models/directus";
import { generatePlanPDF, generatePlanPDFBuffer } from "../services/pdfGenerator";
import { sendPlanPdfEmail } from "../services/email.service";
import { PlanPDFData } from "../types/plan";
import "dotenv/config";

async function getPlanPdfData(idPlan: number, userId: string): Promise<PlanPDFData> {
  const plan = await Planes.getPlanById(idPlan);
  if (!plan) throw { status: 404, error: "Plan no encontrado" };

  if (plan.fisio !== userId) {
    throw { status: 403, error: "No autorizado para acceder a este plan" };
  }

  const ejercicios = await Planes.getEjerciciosByPlan(idPlan);

  const clinica = await Planes.getClinicaByFisio(plan.fisio);
  if (!clinica) throw { status: 404, error: "Clinica no encontrada" };

  const [paciente, fisio] = await Promise.all([
    getUserById(plan.paciente),
    getUserById(plan.fisio),
  ]);

  if (!paciente || !fisio) throw { status: 404, error: "Usuario no encontrado" };

  const tokens = await getTokensUsuario(paciente.id);
  const tokenActivo = tokens.find(t => t.activo && (!t.fecha_expiracion || new Date(t.fecha_expiracion) > new Date()));
  const appUrl = process.env.APP_URL || 'https://kengoapp.com';

  let magicLinkUrl: string;
  if (tokenActivo) {
    magicLinkUrl = `${appUrl}/magic?t=${tokenActivo.token}`;
  } else {
    const nuevoToken = await createTokenAccesoUsuario(paciente.id, userId);
    magicLinkUrl = nuevoToken.url;
  }

  return { plan, ejercicios, clinica, paciente, fisio, magicLinkUrl };
}

function parseIdPlan(req: AuthenticatedRequest): number {
  const idParam = req.params.id;
  const idPlan = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);
  if (isNaN(idPlan)) throw { status: 400, error: "ID de plan invalido" };
  return idPlan;
}

export class pdfController {
  static async generarPlanPDF(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const idPlan = parseIdPlan(req);
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }

      const pdfData = await getPlanPdfData(idPlan, userId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="plan_${idPlan}_${pdfData.paciente.last_name}.pdf"`
      );

      await generatePlanPDF(pdfData, res);
    } catch (error: any) {
      if (error.status && error.error) {
        res.status(error.status).json({ error: error.error });
        return;
      }
      console.error("Error generando PDF:", error);
      res.status(500).json({ error: "Error generando PDF", message: error.message });
    }
  }

  static async enviarPlanPDF(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const idPlan = parseIdPlan(req);
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }

      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: "Email es requerido" });
        return;
      }

      const pdfData = await getPlanPdfData(idPlan, userId);

      const pdfBuffer = await generatePlanPDFBuffer(pdfData);
      const pdfFilename = `plan_${idPlan}_${pdfData.paciente.last_name}.pdf`;

      const enviado = await sendPlanPdfEmail({
        email: email.trim(),
        nombrePaciente: `${pdfData.paciente.first_name} ${pdfData.paciente.last_name}`,
        nombreFisio: `${pdfData.fisio.first_name} ${pdfData.fisio.last_name}`,
        tituloPlan: pdfData.plan.titulo,
        nombreClinica: pdfData.clinica.nombre,
        pdfBuffer,
        pdfFilename,
      });

      if (!enviado) {
        res.status(500).json({ error: "Error al enviar el email" });
        return;
      }

      res.json({ success: true });
    } catch (error: any) {
      if (error.status && error.error) {
        res.status(error.status).json({ error: error.error });
        return;
      }
      console.error("Error enviando PDF por email:", error);
      res.status(500).json({ error: "Error enviando PDF por email", message: error.message });
    }
  }
}
