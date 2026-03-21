import { Response } from "express";
import pool from "../utils/database";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { RowDataPacket } from "mysql2";
import type { ResumenFisioDashboard, PlanPorVencer } from "@kengo/shared-models";

interface PacientesActivosRow extends RowDataPacket {
  total: number;
}

interface AdherenciaRow extends RowDataPacket {
  adherencia: number;
}

interface PlanPorVencerRow extends RowDataPacket {
  id_plan: number;
  titulo: string;
  fecha_fin: string;
  paciente_nombre: string;
  paciente_id: string;
}

class DashboardController {
  async getResumenFisio(
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
        const resumen: ResumenFisioDashboard = {
          pacientes_activos: 0,
          adherencia_promedio: 0,
          planes_por_vencer: [],
        };
        res.json(resumen);
        return;
      }

      const placeholders = clinicaIds.map(() => "?").join(",");

      // 2. Contar pacientes activos distintos (pacientes con planes activos, cuyo fisio pertenece a las mismas clínicas)
      const [pacientesRows] = await pool.execute<PacientesActivosRow[]>(
        `SELECT COUNT(DISTINCT p.paciente) AS total
         FROM Planes p
         WHERE p.estado = 'activo'
           AND p.fisio IN (
             SELECT uc.id_usuario FROM usuarios_clinicas uc
             WHERE uc.id_clinica IN (${placeholders})
             AND uc.id_puesto IN (1, 4)
           )`,
        clinicaIds
      );

      const pacientesActivos = pacientesRows[0]?.total ?? 0;

      // 3. Adherencia promedio últimos 30 días
      const [adherenciaRows] = await pool.execute<AdherenciaRow[]>(
        `SELECT
           CASE WHEN SUM(cd.ejercicios_esperados) > 0
             THEN ROUND(SUM(cd.ejercicios_completados) / SUM(cd.ejercicios_esperados) * 100)
             ELSE 0
           END AS adherencia
         FROM cumplimiento_diario cd
         INNER JOIN Planes pl ON pl.id_plan = cd.plan
         WHERE cd.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           AND cd.es_dia_descanso = 0
           AND pl.fisio IN (
             SELECT uc.id_usuario FROM usuarios_clinicas uc
             WHERE uc.id_clinica IN (${placeholders})
             AND uc.id_puesto IN (1, 4)
           )`,
        clinicaIds
      );

      const adherenciaPromedio = adherenciaRows[0]?.adherencia ?? 0;

      // 4. Planes por vencer (fecha_fin entre hoy y +7 días, estado activo)
      const [planesRows] = await pool.execute<PlanPorVencerRow[]>(
        `SELECT p.id_plan, p.titulo, DATE_FORMAT(p.fecha_fin, '%Y-%m-%d') AS fecha_fin,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS paciente_nombre,
                p.paciente AS paciente_id
         FROM Planes p
         INNER JOIN directus_users u ON u.id = p.paciente
         WHERE p.estado = 'activo'
           AND p.fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
           AND p.fisio IN (
             SELECT uc.id_usuario FROM usuarios_clinicas uc
             WHERE uc.id_clinica IN (${placeholders})
             AND uc.id_puesto IN (1, 4)
           )
         ORDER BY p.fecha_fin ASC
         LIMIT 10`,
        clinicaIds
      );

      const planesPorVencer: PlanPorVencer[] = planesRows.map((r) => ({
        id_plan: r.id_plan,
        titulo: r.titulo,
        fecha_fin: r.fecha_fin,
        paciente_nombre: r.paciente_nombre.trim(),
        paciente_id: r.paciente_id,
      }));

      const resumen: ResumenFisioDashboard = {
        pacientes_activos: pacientesActivos,
        adherencia_promedio: adherenciaPromedio,
        planes_por_vencer: planesPorVencer,
      };

      res.json(resumen);
    } catch (error) {
      console.error("Error obteniendo resumen fisio:", error);
      res.status(500).json({ error: "Error obteniendo resumen del dashboard" });
    }
  }
}

export const dashboardController = new DashboardController();
