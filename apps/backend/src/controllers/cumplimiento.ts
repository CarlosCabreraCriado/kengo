import { Response } from "express";
import pool from "../utils/database";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { RowDataPacket } from "mysql2";
import type {
  CumplimientoDia,
  TipoCumplimiento,
  ResumenCumplimiento,
  CumplimientoResponse,
} from "@kengo/shared-models";

interface CumplimientoRow extends RowDataPacket {
  fecha: string | Date;
  plan: number;
  titulo: string;
  ejercicios_esperados: number;
  ejercicios_completados: number;
  es_dia_descanso: number;
  dolor_promedio: number | null;
}

class CumplimientoController {
  async getCumplimiento(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id: pacienteId } = req.params;

      // Defaults: últimos 30 días hasta ayer
      const hoy = new Date();
      const hace30 = new Date();
      hace30.setDate(hoy.getDate() - 30);

      const desde =
        (req.query.desde as string) || hace30.toISOString().split("T")[0];
      const hasta =
        (req.query.hasta as string) || hoy.toISOString().split("T")[0];

      const [rows] = await pool.execute<CumplimientoRow[]>(
        `SELECT cd.fecha, cd.plan, cd.ejercicios_esperados, cd.ejercicios_completados,
                cd.es_dia_descanso, cd.dolor_promedio, p.titulo
         FROM cumplimiento_diario cd
         INNER JOIN Planes p ON p.id_plan = cd.plan
         WHERE cd.paciente = ? AND cd.fecha BETWEEN ? AND ?
         ORDER BY cd.fecha DESC, cd.plan`,
        [pacienteId, desde, hasta]
      );

      // Agrupar por fecha
      const porFecha = new Map<
        string,
        {
          planes: {
            plan_id: number;
            titulo: string;
            esperados: number;
            completados: number;
          }[];
          totalEsperados: number;
          totalCompletados: number;
          todoDescanso: boolean;
          dolores: number[];
        }
      >();

      for (const row of rows) {
        const fechaKey =
          row.fecha instanceof Date
            ? row.fecha.toISOString().split("T")[0]
            : String(row.fecha);

        if (!porFecha.has(fechaKey)) {
          porFecha.set(fechaKey, {
            planes: [],
            totalEsperados: 0,
            totalCompletados: 0,
            todoDescanso: true,
            dolores: [],
          });
        }

        const grupo = porFecha.get(fechaKey)!;
        grupo.planes.push({
          plan_id: row.plan,
          titulo: row.titulo,
          esperados: row.ejercicios_esperados,
          completados: row.ejercicios_completados,
        });
        grupo.totalEsperados += row.ejercicios_esperados;
        grupo.totalCompletados += row.ejercicios_completados;
        if (!row.es_dia_descanso) {
          grupo.todoDescanso = false;
        }
        if (row.dolor_promedio !== null) {
          grupo.dolores.push(row.dolor_promedio);
        }
      }

      // Clasificar días
      const dias: CumplimientoDia[] = [];
      let diasProgramados = 0;
      let diasCompletados = 0;
      let diasParciales = 0;
      let diasFallidos = 0;
      let diasDescanso = 0;

      for (const [fecha, grupo] of porFecha) {
        let tipo: TipoCumplimiento;

        if (grupo.todoDescanso) {
          tipo = "descanso";
          diasDescanso++;
        } else if (
          grupo.totalCompletados >= grupo.totalEsperados &&
          grupo.totalEsperados > 0
        ) {
          tipo = "completado";
          diasProgramados++;
          diasCompletados++;
        } else if (grupo.totalCompletados > 0) {
          tipo = "parcial";
          diasProgramados++;
          diasParciales++;
        } else {
          tipo = "fallido";
          diasProgramados++;
          diasFallidos++;
        }

        const dolorPromedio =
          grupo.dolores.length > 0
            ? Math.round(
                (grupo.dolores.reduce((a, b) => a + b, 0) /
                  grupo.dolores.length) *
                  10
              ) / 10
            : null;

        dias.push({
          fecha,
          tipo,
          ejercicios_esperados: grupo.totalEsperados,
          ejercicios_completados: grupo.totalCompletados,
          dolor_promedio: dolorPromedio,
          planes: grupo.planes,
        });
      }

      const resumen: ResumenCumplimiento = {
        dias_programados: diasProgramados,
        dias_completados: diasCompletados,
        dias_parciales: diasParciales,
        dias_fallidos: diasFallidos,
        dias_descanso: diasDescanso,
        adherencia_real:
          diasProgramados > 0
            ? Math.round((diasCompletados / diasProgramados) * 100)
            : 0,
      };

      const response: CumplimientoResponse = { dias, resumen };
      res.json(response);
    } catch (error) {
      console.error("Error obteniendo cumplimiento:", error);
      res.status(500).json({ error: "Error obteniendo cumplimiento" });
    }
  }
}

export const cumplimientoController = new CumplimientoController();
