import db from "../utils/database";
import { PlanData, EjercicioPlan, ClinicaData } from "../types/plan";
import { RowDataPacket } from "mysql2";

export default class Planes {
  static async getPlanById(idPlan: number): Promise<PlanData | null> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id_plan, titulo, descripcion, estado, fecha_inicio, fecha_fin, paciente, fisio
       FROM Planes
       WHERE id_plan = ?`,
      [idPlan]
    );

    return rows.length > 0 ? (rows[0] as PlanData) : null;
  }

  static async getEjerciciosByPlan(idPlan: number): Promise<EjercicioPlan[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
         pe.id, pe.sort, pe.series, pe.repeticiones,
         pe.duracion_seg, pe.descanso_seg, pe.veces_dia,
         pe.dias_semana, pe.instrucciones_paciente, pe.notas_fisio,
         e.id_ejercicio, e.nombre_ejercicio, e.descripcion AS ejercicio_descripcion,
         e.portada
       FROM planes_ejercicios pe
       INNER JOIN ejercicios e ON pe.ejercicio = e.id_ejercicio
       WHERE pe.plan = ?
       ORDER BY pe.sort ASC`,
      [idPlan]
    );

    return rows as EjercicioPlan[];
  }

  static async getClinicaByFisio(fisioId: string): Promise<ClinicaData | null> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
         c.id_clinica, c.nombre, c.telefono, c.email,
         c.direccion, c.postal, c.logo,
         c.color_primario, c.color_secundario
       FROM clinicas c
       INNER JOIN usuarios_clinicas uc ON c.id_clinica = uc.id_clinica
       WHERE uc.id_usuario = ?
       LIMIT 1`,
      [fisioId]
    );

    return rows.length > 0 ? (rows[0] as ClinicaData) : null;
  }
}
