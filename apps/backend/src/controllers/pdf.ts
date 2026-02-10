import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import Planes from "../models/planes";
import { getUserById, getTokensUsuario, createTokenAccesoUsuario } from "../models/directus";
import { generatePlanPDF } from "../services/pdfGenerator";
import { PlanPDFData } from "../types/plan";
import "dotenv/config";

export class pdfController {
  static async generarPlanPDF(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const idParam = req.params.id;
      const idPlan = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

      if (isNaN(idPlan)) {
        res.status(400).json({ error: "ID de plan invalido" });
        return;
      }

      const plan = await Planes.getPlanById(idPlan);
      if (!plan) {
        res.status(404).json({ error: "Plan no encontrado" });
        return;
      }

      const userId = req.user?.id;
      if (plan.fisio !== userId) {
        res.status(403).json({ error: "No autorizado para acceder a este plan" });
        return;
      }

      const ejercicios = await Planes.getEjerciciosByPlan(idPlan);

      const clinica = await Planes.getClinicaByFisio(plan.fisio);
      if (!clinica) {
        res.status(404).json({ error: "Clinica no encontrada" });
        return;
      }

      const [paciente, fisio] = await Promise.all([
        getUserById(plan.paciente),
        getUserById(plan.fisio),
      ]);

      if (!paciente || !fisio) {
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }

      // Reutilizar token activo existente o crear uno nuevo
      const tokens = await getTokensUsuario(paciente.id);
      const tokenActivo = tokens.find(t => t.activo && (!t.fecha_expiracion || new Date(t.fecha_expiracion) > new Date()));
      const appUrl = process.env.APP_URL || 'https://kengoapp.com';

      let magicLinkUrl: string;
      if (tokenActivo) {
        magicLinkUrl = `${appUrl}/magic?t=${tokenActivo.token}`;
      } else {
        const nuevoToken = await createTokenAccesoUsuario(paciente.id, userId!);
        magicLinkUrl = nuevoToken.url;
      }

      const pdfData: PlanPDFData = {
        plan,
        ejercicios,
        clinica,
        paciente,
        fisio,
        magicLinkUrl,
      };

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="plan_${idPlan}_${paciente.last_name}.pdf"`
      );

      await generatePlanPDF(pdfData, res);
    } catch (error: any) {
      console.error("Error generando PDF:", error);
      res.status(500).json({ error: "Error generando PDF", message: error.message });
    }
  }

}
