import { Response } from "express";
import pool from "../utils/database";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type {
  NotificacionFisio,
  TipoNotificacionFisio,
  ComentariosPacienteResponse,
  NotificacionApp,
  NotificacionesAppResponse,
} from "@kengo/shared-models";

interface NotificacionRow extends RowDataPacket {
  id: number;
  tipo: string;
  paciente: string;
  id_clinica: number;
  id_registro: number | null;
  id_sesion: number | null;
  fecha_registro: string | Date;
  titulo_plan: string | null;
  nombre_ejercicio: string | null;
  texto: string | null;
  dolor_escala: number | null;
  revisada: number;
  fecha_revision: string | Date | null;
  date_created: string | Date | null;
}

interface NotificacionAppRow extends RowDataPacket {
  id: number;
  tipo: string;
  paciente: string;
  id_clinica: number;
  id_registro: number | null;
  id_sesion: number | null;
  fecha_registro: string | Date;
  titulo_plan: string | null;
  nombre_ejercicio: string | null;
  texto: string | null;
  revisada: number;
  emisor_nombre: string;
  emisor_avatar: string | null;
}

interface ClinicaCheckRow extends RowDataPacket {
  id_clinica: number;
}

/**
 * Verifica que el fisio solicitante comparte clínica con el paciente
 */
async function verificarAccesoFisio(
  fisioId: string,
  pacienteId: string
): Promise<boolean> {
  const [rows] = await pool.execute<ClinicaCheckRow[]>(
    `SELECT uc_fisio.id_clinica
     FROM usuarios_clinicas uc_fisio
     INNER JOIN usuarios_clinicas uc_paciente
       ON uc_paciente.id_clinica = uc_fisio.id_clinica
     WHERE uc_fisio.id_usuario = ? AND uc_fisio.id_puesto IN (1, 4)
       AND uc_paciente.id_usuario = ? AND uc_paciente.id_puesto = 2
     LIMIT 1`,
    [fisioId, pacienteId]
  );
  return rows.length > 0;
}

function toDateString(val: string | Date | null): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function mapRow(row: NotificacionRow): NotificacionFisio {
  return {
    id: row.id,
    tipo: row.tipo as TipoNotificacionFisio,
    paciente: row.paciente,
    id_clinica: row.id_clinica,
    id_registro: row.id_registro,
    id_sesion: row.id_sesion,
    fecha_registro: toDateString(row.fecha_registro) ?? "",
    titulo_plan: row.titulo_plan,
    nombre_ejercicio: row.nombre_ejercicio,
    texto: row.texto,
    dolor_escala: row.dolor_escala,
    revisada: !!row.revisada,
    fecha_revision: toDateString(row.fecha_revision),
    date_created: toDateString(row.date_created),
  };
}

class NotificacionesController {
  async getComentariosPaciente(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const fisioId = req.user?.id;
      const pacienteId = req.params.id as string;

      if (!fisioId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const tieneAcceso = await verificarAccesoFisio(fisioId, pacienteId);
      if (!tieneAcceso) {
        res.status(403).json({ error: "Sin acceso a este paciente" });
        return;
      }

      const [rows] = await pool.execute<NotificacionRow[]>(
        `SELECT id, tipo, paciente, id_clinica, id_registro, id_sesion, fecha_registro,
                titulo_plan, nombre_ejercicio, texto, dolor_escala,
                revisada, fecha_revision, date_created
         FROM notificaciones_fisio
         WHERE paciente = ? AND tipo = 'comentario'
         ORDER BY fecha_registro DESC
         LIMIT 50`,
        [pacienteId]
      );

      const comentarios = rows.map(mapRow);
      const pendientes = comentarios.filter((c) => !c.revisada).length;

      const response: ComentariosPacienteResponse = {
        comentarios,
        pendientes,
        total: comentarios.length,
      };

      res.json(response);
    } catch (error) {
      console.error("Error obteniendo comentarios:", error);
      res.status(500).json({ error: "Error obteniendo comentarios" });
    }
  }

  async marcarRevisada(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const fisioId = req.user?.id;
      const notificacionId = req.params.id as string;

      if (!fisioId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      // Obtener la notificación para verificar acceso
      const [notifRows] = await pool.execute<NotificacionRow[]>(
        `SELECT paciente FROM notificaciones_fisio WHERE id = ?`,
        [notificacionId]
      );

      if (notifRows.length === 0) {
        res.status(404).json({ error: "Notificación no encontrada" });
        return;
      }

      const tieneAcceso = await verificarAccesoFisio(fisioId, notifRows[0].paciente);
      if (!tieneAcceso) {
        res.status(403).json({ error: "Sin acceso a esta notificación" });
        return;
      }

      await pool.execute<ResultSetHeader>(
        `UPDATE notificaciones_fisio SET revisada = 1, fecha_revision = NOW() WHERE id = ?`,
        [notificacionId]
      );

      res.json({ ok: true });
    } catch (error) {
      console.error("Error marcando notificación como revisada:", error);
      res.status(500).json({ error: "Error actualizando notificación" });
    }
  }

  async marcarTodasRevisadas(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const fisioId = req.user?.id;
      const pacienteId = req.params.id as string;

      if (!fisioId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const tieneAcceso = await verificarAccesoFisio(fisioId, pacienteId);
      if (!tieneAcceso) {
        res.status(403).json({ error: "Sin acceso a este paciente" });
        return;
      }

      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE notificaciones_fisio SET revisada = 1, fecha_revision = NOW()
         WHERE paciente = ? AND revisada = 0`,
        [pacienteId]
      );

      res.json({ ok: true, actualizadas: result.affectedRows });
    } catch (error) {
      console.error("Error marcando todas como revisadas:", error);
      res.status(500).json({ error: "Error actualizando notificaciones" });
    }
  }

  async getMisNotificaciones(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const [rows] = await pool.execute<NotificacionAppRow[]>(
        `SELECT nf.id, nf.tipo, nf.id_clinica, nf.id_registro, nf.id_sesion,
                nf.fecha_registro, nf.titulo_plan, nf.nombre_ejercicio, nf.texto,
                nf.revisada, nf.paciente,
                CONCAT(du.first_name, ' ', du.last_name) AS emisor_nombre,
                du.avatar AS emisor_avatar
         FROM notificaciones_fisio nf
           INNER JOIN usuarios_clinicas uc ON uc.id_clinica = nf.id_clinica
           INNER JOIN directus_users du ON du.id = nf.paciente
         WHERE uc.id_usuario = ? AND uc.id_puesto IN (1, 4)
         ORDER BY nf.fecha_registro DESC
         LIMIT 50`,
        [userId]
      );

      const notificaciones: NotificacionApp[] = rows.map((row) => ({
        id: row.id,
        fuente: "notificaciones_fisio",
        categoria: "comentario_paciente",
        emisor_nombre: row.emisor_nombre,
        emisor_avatar: row.emisor_avatar,
        emisor_id: row.paciente,
        titulo: row.nombre_ejercicio
          ? `${row.titulo_plan} · ${row.nombre_ejercicio}`
          : "Observación de sesión",
        texto: row.texto,
        fecha: toDateString(row.fecha_registro) ?? "",
        leida: !!row.revisada,
        ruta_destino: `/mis-pacientes/${row.paciente}`,
      }));

      const pendientes = notificaciones.filter((n) => !n.leida).length;

      const response: NotificacionesAppResponse = {
        notificaciones,
        pendientes,
        total: notificaciones.length,
      };

      res.json(response);
    } catch (error) {
      console.error("Error obteniendo mis notificaciones:", error);
      res.status(500).json({ error: "Error obteniendo notificaciones" });
    }
  }

  async marcarTodasMisNotificacionesRevisadas(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE notificaciones_fisio nf
           INNER JOIN usuarios_clinicas uc ON uc.id_clinica = nf.id_clinica
         SET nf.revisada = 1, nf.fecha_revision = NOW()
         WHERE uc.id_usuario = ? AND uc.id_puesto IN (1, 4) AND nf.revisada = 0`,
        [userId]
      );

      res.json({ ok: true, actualizadas: result.affectedRows });
    } catch (error) {
      console.error("Error marcando todas mis notificaciones:", error);
      res.status(500).json({ error: "Error actualizando notificaciones" });
    }
  }
}

export const notificacionesController = new NotificacionesController();
