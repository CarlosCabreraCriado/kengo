import { Response } from "express";
import pool from "../utils/database";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { RowDataPacket } from "mysql2";
import type { MetricasPaciente, MetricasPacientesBulk } from "@kengo/shared-models";

interface MetricasRow extends RowDataPacket {
  paciente: string;
  adherencia: number;
  dolor_promedio: number | null;
}

class MetricasPacientesController {
  async getMetricasBulk(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;

      // 1. Obtener clínicas donde el usuario es fisio (1) o admin (4)
      const [clinicasRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id_clinica FROM usuarios_clinicas
         WHERE id_usuario = ? AND id_puesto IN (1, 4)`,
        [userId]
      );

      const clinicaIds = clinicasRows.map((r) => r.id_clinica);

      if (clinicaIds.length === 0) {
        res.json({});
        return;
      }

      const placeholders = clinicaIds.map(() => "?").join(",");

      // 2. Métricas agregadas por paciente (últimos 30 días)
      const [rows] = await pool.execute<MetricasRow[]>(
        `SELECT
           cd.paciente,
           CASE WHEN SUM(CASE WHEN cd.es_dia_descanso = 0 THEN cd.ejercicios_esperados ELSE 0 END) > 0
             THEN ROUND(
               SUM(CASE WHEN cd.es_dia_descanso = 0 THEN cd.ejercicios_completados ELSE 0 END)
               / SUM(CASE WHEN cd.es_dia_descanso = 0 THEN cd.ejercicios_esperados ELSE 0 END) * 100
             )
             ELSE 0
           END AS adherencia,
           ROUND(AVG(
             CASE WHEN cd.dolor_promedio IS NOT NULL AND cd.es_dia_descanso = 0
               THEN cd.dolor_promedio ELSE NULL END
           ), 1) AS dolor_promedio
         FROM cumplimiento_diario cd
         INNER JOIN Planes pl ON pl.id_plan = cd.plan
         WHERE cd.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           AND pl.fisio IN (
             SELECT uc.id_usuario FROM usuarios_clinicas uc
             WHERE uc.id_clinica IN (${placeholders})
             AND uc.id_puesto IN (1, 4)
           )
         GROUP BY cd.paciente`,
        clinicaIds
      );

      // 3. Transformar a mapa
      const result: MetricasPacientesBulk = {};
      for (const row of rows) {
        result[row.paciente] = {
          adherencia: row.adherencia ?? 0,
          dolor_promedio: row.dolor_promedio,
        };
      }

      res.json(result);
    } catch (error) {
      console.error("Error obteniendo métricas de pacientes:", error);
      res.status(500).json({ error: "Error obteniendo métricas de pacientes" });
    }
  }
}

export const metricasPacientesController = new MetricasPacientesController();
