import pool from "../utils/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface RegistroConComentarioRow extends RowDataPacket {
  id_registro: number;
  paciente: string;
  fecha_hora: string;
  nota_paciente: string;
  dolor_escala: number | null;
  titulo_plan: string;
  nombre_ejercicio: string;
  id_clinica: number;
}

/**
 * Genera notificaciones de tipo 'comentario' para registros con nota_paciente
 * que aún no tienen notificación asociada.
 *
 * @param pacienteId - Opcional, para procesar solo un paciente (usado por el hook)
 * @returns Número de notificaciones insertadas
 */
export async function generarNotificacionesComentarios(
  pacienteId?: string
): Promise<number> {
  try {
    let query = `
      SELECT pr.id_registro, pr.paciente, pr.fecha_hora, pr.nota_paciente, pr.dolor_escala,
             p.titulo AS titulo_plan,
             e.nombre_ejercicio,
             uc.id_clinica
      FROM planes_registros pr
        JOIN planes_ejercicios pe ON pe.id = pr.plan_item
        JOIN Planes p ON p.id_plan = pe.plan
        JOIN ejercicios e ON e.id_ejercicio = pe.ejercicio
        JOIN usuarios_clinicas uc ON uc.id_usuario = pr.paciente
        LEFT JOIN notificaciones_fisio nf ON nf.id_registro = pr.id_registro AND nf.tipo = 'comentario'
      WHERE pr.nota_paciente IS NOT NULL AND pr.nota_paciente != ''
        AND pr.completado = 1
        AND pr.fecha_hora >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND nf.id IS NULL
    `;
    const params: string[] = [];

    if (pacienteId) {
      query += ` AND pr.paciente = ?`;
      params.push(pacienteId);
    }

    const [rows] = await pool.execute<RegistroConComentarioRow[]>(query, params);

    if (rows.length === 0) {
      console.log(`[notificaciones] Sin comentarios nuevos para procesar`);
      return 0;
    }

    let insertadas = 0;

    for (const row of rows) {
      try {
        const [result] = await pool.execute<ResultSetHeader>(
          `INSERT IGNORE INTO notificaciones_fisio
            (tipo, paciente, id_clinica, id_registro, fecha_registro, titulo_plan, nombre_ejercicio, texto, dolor_escala, revisada)
          VALUES ('comentario', ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            row.paciente,
            row.id_clinica,
            row.id_registro,
            row.fecha_hora,
            row.titulo_plan,
            row.nombre_ejercicio,
            row.nota_paciente,
            row.dolor_escala,
          ]
        );
        insertadas += result.affectedRows;
      } catch (err) {
        console.error(`[notificaciones] Error insertando notificación para registro ${row.id_registro}:`, err);
      }
    }

    console.log(`[notificaciones] ${insertadas} notificación(es) de comentarios generada(s)`);
    return insertadas;
  } catch (error) {
    console.error("[notificaciones] Error generando notificaciones de comentarios:", error);
    throw error;
  }
}

interface SesionConObservacionRow extends RowDataPacket {
  id_sesion: number;
  paciente: string;
  fecha_inicio: string;
  observaciones_generales: string;
  id_clinica: number;
}

/**
 * Genera notificaciones de tipo 'comentario' para sesiones con observaciones_generales
 * que aún no tienen notificación asociada.
 */
export async function generarNotificacionesSesiones(
  pacienteId?: string
): Promise<number> {
  try {
    let query = `
      SELECT s.id AS id_sesion, s.paciente, s.fecha_inicio, s.observaciones_generales,
             uc.id_clinica
      FROM sesiones s
        JOIN usuarios_clinicas uc ON uc.id_usuario = s.paciente
        LEFT JOIN notificaciones_fisio nf ON nf.id_sesion = s.id AND nf.tipo = 'comentario'
      WHERE s.observaciones_generales IS NOT NULL AND s.observaciones_generales != ''
        AND s.completada = 1
        AND s.fecha_inicio >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND nf.id IS NULL
    `;
    const params: string[] = [];

    if (pacienteId) {
      query += ` AND s.paciente = ?`;
      params.push(pacienteId);
    }

    const [rows] = await pool.execute<SesionConObservacionRow[]>(query, params);

    if (rows.length === 0) {
      console.log(`[notificaciones] Sin observaciones de sesión nuevas para procesar`);
      return 0;
    }

    let insertadas = 0;

    for (const row of rows) {
      try {
        const [result] = await pool.execute<ResultSetHeader>(
          `INSERT IGNORE INTO notificaciones_fisio
            (tipo, paciente, id_clinica, id_registro, id_sesion, fecha_registro, titulo_plan, nombre_ejercicio, texto, dolor_escala, revisada)
          VALUES ('comentario', ?, ?, NULL, ?, ?, 'Sesión de trabajo', NULL, ?, NULL, 0)`,
          [
            row.paciente,
            row.id_clinica,
            row.id_sesion,
            row.fecha_inicio,
            row.observaciones_generales,
          ]
        );
        insertadas += result.affectedRows;
      } catch (err) {
        console.error(`[notificaciones] Error insertando notificación para sesión ${row.id_sesion}:`, err);
      }
    }

    console.log(`[notificaciones] ${insertadas} notificación(es) de observaciones de sesión generada(s)`);
    return insertadas;
  } catch (error) {
    console.error("[notificaciones] Error generando notificaciones de sesiones:", error);
    throw error;
  }
}

/**
 * Genera todas las notificaciones: comentarios de ejercicios + observaciones de sesión.
 */
export async function generarTodasNotificaciones(
  pacienteId?: string
): Promise<number> {
  const comentarios = await generarNotificacionesComentarios(pacienteId);
  const sesiones = await generarNotificacionesSesiones(pacienteId);
  return comentarios + sesiones;
}

/**
 * Backfill: genera notificaciones sin el filtro de 7 días.
 * Útil para procesamiento histórico.
 */
export async function backfillNotificaciones(
  desde: string,
  hasta?: string
): Promise<number> {
  try {
    const fechaHasta = hasta || new Date().toISOString().split("T")[0];

    const [rows] = await pool.execute<RegistroConComentarioRow[]>(
      `SELECT pr.id_registro, pr.paciente, pr.fecha_hora, pr.nota_paciente, pr.dolor_escala,
              p.titulo AS titulo_plan,
              e.nombre_ejercicio,
              uc.id_clinica
       FROM planes_registros pr
         JOIN planes_ejercicios pe ON pe.id = pr.plan_item
         JOIN Planes p ON p.id_plan = pe.plan
         JOIN ejercicios e ON e.id_ejercicio = pe.ejercicio
         JOIN usuarios_clinicas uc ON uc.id_usuario = pr.paciente
         LEFT JOIN notificaciones_fisio nf ON nf.id_registro = pr.id_registro AND nf.tipo = 'comentario'
       WHERE pr.nota_paciente IS NOT NULL AND pr.nota_paciente != ''
         AND pr.completado = 1
         AND DATE(pr.fecha_hora) >= ?
         AND DATE(pr.fecha_hora) <= ?
         AND nf.id IS NULL`,
      [desde, fechaHasta]
    );

    let insertadas = 0;

    if (rows.length === 0) {
      console.log(`[backfill-notif] Sin comentarios de ejercicio pendientes en rango ${desde} - ${fechaHasta}`);
    }

    for (const row of rows) {
      try {
        const [result] = await pool.execute<ResultSetHeader>(
          `INSERT IGNORE INTO notificaciones_fisio
            (tipo, paciente, id_clinica, id_registro, fecha_registro, titulo_plan, nombre_ejercicio, texto, dolor_escala, revisada)
          VALUES ('comentario', ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            row.paciente,
            row.id_clinica,
            row.id_registro,
            row.fecha_hora,
            row.titulo_plan,
            row.nombre_ejercicio,
            row.nota_paciente,
            row.dolor_escala,
          ]
        );
        insertadas += result.affectedRows;
      } catch (err) {
        console.error(`[backfill-notif] Error insertando para registro ${row.id_registro}:`, err);
      }
    }

    // También backfill de observaciones de sesión
    const [sesionRows] = await pool.execute<SesionConObservacionRow[]>(
      `SELECT s.id AS id_sesion, s.paciente, s.fecha_inicio, s.observaciones_generales,
              uc.id_clinica
       FROM sesiones s
         JOIN usuarios_clinicas uc ON uc.id_usuario = s.paciente
         LEFT JOIN notificaciones_fisio nf ON nf.id_sesion = s.id AND nf.tipo = 'comentario'
       WHERE s.observaciones_generales IS NOT NULL AND s.observaciones_generales != ''
         AND s.completada = 1
         AND DATE(s.fecha_inicio) >= ?
         AND DATE(s.fecha_inicio) <= ?
         AND nf.id IS NULL`,
      [desde, fechaHasta]
    );

    for (const row of sesionRows) {
      try {
        const [result] = await pool.execute<ResultSetHeader>(
          `INSERT IGNORE INTO notificaciones_fisio
            (tipo, paciente, id_clinica, id_registro, id_sesion, fecha_registro, titulo_plan, nombre_ejercicio, texto, dolor_escala, revisada)
          VALUES ('comentario', ?, ?, NULL, ?, ?, 'Sesión de trabajo', NULL, ?, NULL, 0)`,
          [
            row.paciente,
            row.id_clinica,
            row.id_sesion,
            row.fecha_inicio,
            row.observaciones_generales,
          ]
        );
        insertadas += result.affectedRows;
      } catch (err) {
        console.error(`[backfill-notif] Error insertando para sesión ${row.id_sesion}:`, err);
      }
    }

    console.log(`[backfill-notif] ${insertadas} notificación(es) generada(s) para rango ${desde} - ${fechaHasta}`);
    return insertadas;
  } catch (error) {
    console.error("[backfill-notif] Error en backfill:", error);
    throw error;
  }
}
