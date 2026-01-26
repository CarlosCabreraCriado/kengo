import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  validarCodigoAcceso,
  incrementarUsoCodigo,
  createUsuarioClinica,
  createClinica,
  createCodigoAcceso,
  getCodigosClinica,
  desactivarCodigo,
  getPuestoUsuarioEnClinica,
  usuarioYaVinculado,
  getUserById,
} from '../models/directus';
import { sendCodigoAccesoEmail } from '../services/email.service';
import type {
  CreateClinicaPayload,
  VincularClinicaPayload,
  VincularClinicaResponse,
  CrearClinicaResponse,
  GenerarCodigoPayload,
  GenerarCodigoResponse,
  CodigoAcceso,
} from '@kengo/shared-models';

// Constantes de puestos
const PUESTO_FISIO = 1;
const PUESTO_PAC = 2;
const PUESTO_ADMIN = 4;

// Helper para extraer clinica info del código
interface ClinicaInfo {
  id_clinica: number;
  nombre: string;
}

export class clinicaController {
  /**
   * POST /api/clinica/vincular
   * Vincula un usuario a una clínica mediante código de acceso
   */
  static async vincularUsuarioClinica(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { codigo } = req.body as VincularClinicaPayload;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' } as VincularClinicaResponse);
        return;
      }

      if (!codigo?.trim()) {
        res.status(400).json({ success: false, error: 'El código es requerido' } as VincularClinicaResponse);
        return;
      }

      // Obtener email del usuario para validar códigos vinculados
      const userData = await getUserById(userId);
      const userEmail = userData?.email || undefined;

      // Validar código (pasando email del usuario para verificar vinculación)
      const validacion = await validarCodigoAcceso(codigo.trim().toUpperCase(), userEmail);

      if (!validacion.valido || !validacion.codigoData) {
        const mensajesError: Record<string, string> = {
          CODIGO_NO_ENCONTRADO: 'El código no existe',
          CODIGO_INACTIVO: 'El código ha sido desactivado',
          CODIGO_EXPIRADO: 'El código ha expirado',
          CODIGO_AGOTADO: 'El código ha alcanzado el límite de usos',
          EMAIL_NO_COINCIDE: 'Este código está vinculado a otro email',
        };
        res.status(400).json({
          success: false,
          error: mensajesError[validacion.error || 'CODIGO_NO_ENCONTRADO'],
        } as VincularClinicaResponse);
        return;
      }

      const { codigoData } = validacion;
      // codigoData.id_clinica viene expandido con campos de clínica
      const clinicaData = codigoData.id_clinica as unknown as ClinicaInfo;
      const clinicaId = clinicaData.id_clinica;
      const nombreClinica = clinicaData.nombre || '';

      // Verificar si ya está vinculado
      const yaVinculado = await usuarioYaVinculado(userId, clinicaId);
      if (yaVinculado) {
        res.status(400).json({
          success: false,
          error: 'Ya estás vinculado a esta clínica',
        } as VincularClinicaResponse);
        return;
      }

      // Determinar puesto según tipo de código
      const puesto = codigoData.tipo === 'fisioterapeuta' ? PUESTO_FISIO : PUESTO_PAC;

      // Crear relación usuario-clínica
      await createUsuarioClinica(userId, clinicaId, puesto);

      // Incrementar uso del código
      await incrementarUsoCodigo(codigoData.id);

      res.json({
        success: true,
        clinicaId,
        nombreClinica,
        tipo: codigoData.tipo,
      } as VincularClinicaResponse);
    } catch (error: any) {
      console.error('[Clinica] Error vinculando usuario:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' } as VincularClinicaResponse);
    }
  }

  /**
   * POST /api/clinica/crear
   * Crea una nueva clínica y asigna al creador como administrador
   */
  static async crearClinica(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const payload = req.body as CreateClinicaPayload;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' } as CrearClinicaResponse);
        return;
      }

      if (!payload.nombre?.trim()) {
        res.status(400).json({ success: false, error: 'El nombre de la clínica es requerido' } as CrearClinicaResponse);
        return;
      }

      // Crear la clínica
      const { id_clinica } = await createClinica({
        nombre: payload.nombre.trim(),
        telefono: payload.telefono?.trim(),
        email: payload.email?.trim(),
        direccion: payload.direccion?.trim(),
        postal: payload.postal?.trim(),
        nif: payload.nif?.trim(),
        color_primario: payload.color_primario,
      }, userId);

      // Asignar al creador como administrador de la clínica
      await createUsuarioClinica(userId, id_clinica, PUESTO_ADMIN);

      res.status(201).json({
        success: true,
        clinicaId: id_clinica,
      } as CrearClinicaResponse);
    } catch (error: any) {
      console.error('[Clinica] Error creando clínica:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' } as CrearClinicaResponse);
    }
  }

  /**
   * POST /api/clinica/codigo/generar
   * Genera un nuevo código de acceso para una clínica
   */
  static async generarCodigo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const payload = req.body as GenerarCodigoPayload;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' } as GenerarCodigoResponse);
        return;
      }

      if (!payload.id_clinica) {
        res.status(400).json({ success: false, error: 'El ID de clínica es requerido' } as GenerarCodigoResponse);
        return;
      }

      if (!payload.tipo || !['fisioterapeuta', 'paciente'].includes(payload.tipo)) {
        res.status(400).json({ success: false, error: 'El tipo de código no es válido' } as GenerarCodigoResponse);
        return;
      }

      // Verificar permisos del usuario en la clínica
      const puesto = await getPuestoUsuarioEnClinica(userId, payload.id_clinica);

      if (puesto === null) {
        res.status(403).json({ success: false, error: 'No tienes acceso a esta clínica' } as GenerarCodigoResponse);
        return;
      }

      const esAdmin = puesto === PUESTO_ADMIN;
      const esFisio = puesto === PUESTO_FISIO;

      // Verificar permisos según tipo de código
      if (payload.tipo === 'fisioterapeuta' && !esAdmin) {
        res.status(403).json({
          success: false,
          error: 'Solo los administradores pueden generar códigos para fisioterapeutas',
        } as GenerarCodigoResponse);
        return;
      }

      if (payload.tipo === 'paciente' && !esAdmin && !esFisio) {
        res.status(403).json({
          success: false,
          error: 'No tienes permisos para generar códigos de paciente',
        } as GenerarCodigoResponse);
        return;
      }

      // Validar email si se proporciona
      const emailNormalizado = payload.email?.trim().toLowerCase() || null;
      if (emailNormalizado && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
        res.status(400).json({ success: false, error: 'El email proporcionado no es válido' } as GenerarCodigoResponse);
        return;
      }

      // Generar código
      const { codigo } = await createCodigoAcceso({
        id_clinica: payload.id_clinica,
        tipo: payload.tipo,
        usos_maximos: payload.usos_maximos,
        dias_expiracion: payload.dias_expiracion,
        email: emailNormalizado,
      }, userId);

      // Enviar email de notificación si hay email vinculado
      let emailEnviado = false;
      if (emailNormalizado) {
        // Obtener nombre de la clínica para el email
        const clinicaRes = await fetch(
          `${process.env.DIRECTUS_URL}/items/clinicas/${payload.id_clinica}?fields=nombre`,
          {
            headers: {
              Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
            },
          }
        );
        let nombreClinica = 'tu clínica';
        if (clinicaRes.ok) {
          const clinicaData = await clinicaRes.json();
          nombreClinica = clinicaData.data?.nombre || nombreClinica;
        }

        emailEnviado = await sendCodigoAccesoEmail({
          email: emailNormalizado,
          codigo,
          nombreClinica,
          tipo: payload.tipo,
        });
      }

      res.status(201).json({
        success: true,
        codigo,
        emailEnviado,
      } as GenerarCodigoResponse);
    } catch (error: any) {
      console.error('[Clinica] Error generando código:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' } as GenerarCodigoResponse);
    }
  }

  /**
   * GET /api/clinica/:id/codigos
   * Lista los códigos de acceso de una clínica
   */
  static async listarCodigos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params.id as string;
      const clinicaId = parseInt(idParam, 10);
      const userId = req.user?.id;

      console.log('[listarCodigos] userId:', userId, 'clinicaId:', clinicaId);

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (isNaN(clinicaId)) {
        res.status(400).json({ error: 'ID de clínica inválido' });
        return;
      }

      // Verificar permisos
      const puesto = await getPuestoUsuarioEnClinica(userId, clinicaId);
      console.log('[listarCodigos] puesto encontrado:', puesto);
      const esAdmin = puesto === PUESTO_ADMIN;
      const esFisio = puesto === PUESTO_FISIO;

      if (!esAdmin && !esFisio) {
        console.log('[listarCodigos] Sin permisos - esAdmin:', esAdmin, 'esFisio:', esFisio);
        res.status(403).json({ error: 'No tienes permisos para ver los códigos' });
        return;
      }

      const codigosDB = await getCodigosClinica(clinicaId);

      // Transformar a tipo dominio
      const codigos: CodigoAcceso[] = codigosDB.map(c => ({
        id: c.id,
        codigo: c.codigo,
        tipo: c.tipo,
        activo: c.activo,
        usosMaximos: c.usos_maximos,
        usosActuales: c.usos_actuales,
        fechaExpiracion: c.fecha_expiracion ? new Date(c.fecha_expiracion) : null,
        email: c.email || null,
        fechaCreacion: new Date(c.date_created),
      }));

      // Si es fisio (no admin), solo mostrar códigos de paciente
      const codigosFiltrados = esAdmin
        ? codigos
        : codigos.filter(c => c.tipo === 'paciente');

      res.json(codigosFiltrados);
    } catch (error: any) {
      console.error('[Clinica] Error listando códigos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * PATCH /api/clinica/codigo/:id/desactivar
   * Desactiva un código de acceso
   */
  static async desactivarCodigoAcceso(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params.id as string;
      const codigoId = parseInt(idParam, 10);
      const userId = req.user?.id;
      const { clinicaId } = req.body as { clinicaId: number };

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (isNaN(codigoId)) {
        res.status(400).json({ error: 'ID de código inválido' });
        return;
      }

      if (!clinicaId) {
        res.status(400).json({ error: 'ID de clínica requerido' });
        return;
      }

      // Verificar permisos
      const puesto = await getPuestoUsuarioEnClinica(userId, clinicaId);
      const esAdmin = puesto === PUESTO_ADMIN;
      const esFisio = puesto === PUESTO_FISIO;

      if (!esAdmin && !esFisio) {
        res.status(403).json({ error: 'No tienes permisos para desactivar códigos' });
        return;
      }

      await desactivarCodigo(codigoId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Clinica] Error desactivando código:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

}
