import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  getPuestoUsuarioEnClinica,
  getAsignacionesByClinica,
  getAsignacionByPacienteClinica,
  bulkUpsertAsignaciones,
  usuarioYaVinculado,
} from '../models/directus';
import type {
  AsignacionResponsable,
  BulkAsignacionPayload,
  BulkAsignacionResponse,
} from '@kengo/shared-models';

const PUESTO_FISIO = 1;
const PUESTO_PACIENTE = 2;
const PUESTO_ADMIN = 4;

export class asignacionesController {
  /**
   * GET /api/clinica/:id/asignaciones
   * Lista todas las asignaciones de fisio responsable de una clínica.
   * Accesible por fisios y admins de la clínica.
   */
  static async listarAsignaciones(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clinicaId = parseInt(req.params.id as string, 10);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (isNaN(clinicaId)) {
        res.status(400).json({ error: 'ID de clínica inválido' });
        return;
      }

      // Verificar que el usuario pertenece a la clínica como fisio o admin
      const puesto = await getPuestoUsuarioEnClinica(userId, clinicaId);
      if (puesto !== PUESTO_FISIO && puesto !== PUESTO_ADMIN) {
        res.status(403).json({ error: 'No tienes acceso a esta clínica' });
        return;
      }

      const asignacionesDB = await getAsignacionesByClinica(clinicaId);

      const asignaciones: AsignacionResponsable[] = asignacionesDB.map(a => ({
        id: a.id,
        idPaciente: a.id_paciente,
        idFisio: a.id_fisio,
        idClinica: a.id_clinica,
        nombreFisio: a.nombre_fisio,
        apellidoFisio: a.apellido_fisio,
        fechaCreacion: a.date_created || '',
      }));

      res.json(asignaciones);
    } catch (error) {
      console.error('[Asignaciones] Error listando asignaciones:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * PUT /api/clinica/:id/asignaciones/bulk
   * Asignación masiva de fisios responsables. Solo admins.
   */
  static async bulkAsignar(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clinicaId = parseInt(req.params.id as string, 10);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' } as BulkAsignacionResponse & { error: string });
        return;
      }

      if (isNaN(clinicaId)) {
        res.status(400).json({ success: false, error: 'ID de clínica inválido' } as BulkAsignacionResponse & { error: string });
        return;
      }

      const { asignaciones } = req.body as BulkAsignacionPayload;

      if (!asignaciones || !Array.isArray(asignaciones) || asignaciones.length === 0) {
        res.status(400).json({ success: false, error: 'Se requiere un array de asignaciones' } as BulkAsignacionResponse & { error: string });
        return;
      }

      // Verificar que el usuario es admin en la clínica
      const puesto = await getPuestoUsuarioEnClinica(userId, clinicaId);
      if (puesto !== PUESTO_ADMIN) {
        res.status(403).json({ success: false, error: 'Solo los administradores pueden gestionar asignaciones' } as BulkAsignacionResponse & { error: string });
        return;
      }

      // Validar que cada id_fisio (si no es null) es fisio/admin en la clínica
      for (const a of asignaciones) {
        if (a.id_fisio) {
          const fisioP = await getPuestoUsuarioEnClinica(a.id_fisio, clinicaId);
          if (fisioP !== PUESTO_FISIO && fisioP !== PUESTO_ADMIN) {
            res.status(400).json({
              success: false,
              error: `El usuario ${a.id_fisio} no es fisioterapeuta ni admin en esta clínica`,
            } as BulkAsignacionResponse & { error: string });
            return;
          }
        }

        // Validar que el paciente pertenece a la clínica
        const pacienteVinculado = await usuarioYaVinculado(a.id_paciente, clinicaId);
        if (!pacienteVinculado) {
          res.status(400).json({
            success: false,
            error: `El paciente ${a.id_paciente} no está vinculado a esta clínica`,
          } as BulkAsignacionResponse & { error: string });
          return;
        }
      }

      const resultado = await bulkUpsertAsignaciones(clinicaId, asignaciones, userId);

      res.json({
        success: true,
        asignadas: resultado.asignadas,
        eliminadas: resultado.eliminadas,
      } as BulkAsignacionResponse);
    } catch (error) {
      console.error('[Asignaciones] Error en bulk asignar:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  /**
   * GET /api/paciente/:id/fisio-responsable
   * Obtiene el fisio responsable de un paciente.
   * Requiere que el usuario sea fisio/admin en alguna clínica compartida.
   */
  static async getFisioResponsable(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const pacienteId = req.params.id as string;
      const clinicaId = parseInt(req.query['clinicaId'] as string, 10);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!pacienteId) {
        res.status(400).json({ error: 'ID de paciente requerido' });
        return;
      }

      if (isNaN(clinicaId)) {
        res.status(400).json({ error: 'clinicaId query param requerido' });
        return;
      }

      // Verificar permisos: fisio/admin pueden consultar cualquier paciente,
      // un paciente solo puede consultar su propia asignación
      const puesto = await getPuestoUsuarioEnClinica(userId, clinicaId);
      const isOwnQuery = pacienteId === userId && puesto === PUESTO_PACIENTE;
      const isFisioOrAdmin = puesto === PUESTO_FISIO || puesto === PUESTO_ADMIN;
      if (!isOwnQuery && !isFisioOrAdmin) {
        res.status(403).json({ error: 'No tienes acceso a esta clínica' });
        return;
      }

      const asignacion = await getAsignacionByPacienteClinica(pacienteId, clinicaId);

      if (!asignacion) {
        res.json(null);
        return;
      }

      const result: AsignacionResponsable = {
        id: asignacion.id,
        idPaciente: asignacion.id_paciente,
        idFisio: asignacion.id_fisio,
        idClinica: asignacion.id_clinica,
        nombreFisio: asignacion.nombre_fisio,
        apellidoFisio: asignacion.apellido_fisio,
        avatarFisio: asignacion.avatar_fisio || undefined,
        fechaCreacion: asignacion.date_created || '',
      };

      res.json(result);
    } catch (error) {
      console.error('[Asignaciones] Error obteniendo fisio responsable:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}
