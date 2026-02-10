import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  getUserByEmail,
  countRecentRecoveryRequests,
  createCodigoRecuperacion,
  validarCodigoRecuperacion,
  marcarCodigoUsado,
  updateUserPassword,
  checkUsuarioTienePassword,
} from '../models/directus';
import { sendPasswordResetEmail } from '../services/email.service';
import type {
  SolicitarRecuperacionPayload,
  ResetPasswordPayload,
  SolicitarRecuperacionResult,
  ResetPasswordResult,
  RecuperacionErrorCode,
} from '@kengo/shared-models';

// Configuracion de seguridad
const MAX_SOLICITUDES_POR_HORA = 3;
const MIN_PASSWORD_LENGTH = 6;

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function createErrorResponse(message: string, code: RecuperacionErrorCode): ResetPasswordResult {
  return { success: false, message, code };
}

export class passwordResetController {
  /**
   * POST /auth/recuperar-password
   * Solicita un codigo de recuperacion de contrasena
   * Siempre responde OK para no revelar si el email existe
   */
  static async solicitarCodigo(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as SolicitarRecuperacionPayload;

      // Validar email
      if (!payload.email?.trim() || !isValidEmail(payload.email)) {
        // Responder OK aunque el email no sea valido (seguridad)
        const response: SolicitarRecuperacionResult = {
          success: true,
          message: 'Si el email existe, recibiras un codigo de recuperacion',
        };
        res.status(200).json(response);
        return;
      }

      const normalizedEmail = payload.email.toLowerCase().trim();
      const clientIp = req.ip || req.socket.remoteAddress;

      // Verificar rate limiting
      const recentRequests = await countRecentRecoveryRequests(normalizedEmail);
      if (recentRequests >= MAX_SOLICITUDES_POR_HORA) {
        // Aun asi respondemos OK por seguridad, pero no enviamos email
        console.log(`[PasswordReset] Rate limit excedido para ${normalizedEmail}`);
        const response: SolicitarRecuperacionResult = {
          success: true,
          message: 'Si el email existe, recibiras un codigo de recuperacion',
        };
        res.status(200).json(response);
        return;
      }

      // Buscar usuario por email
      const user = await getUserByEmail(normalizedEmail);
      if (!user) {
        // Responder OK aunque el usuario no exista (seguridad)
        console.log(`[PasswordReset] Email no encontrado: ${normalizedEmail}`);
        const response: SolicitarRecuperacionResult = {
          success: true,
          message: 'Si el email existe, recibiras un codigo de recuperacion',
        };
        res.status(200).json(response);
        return;
      }

      // Crear codigo de recuperacion
      const { codigo } = await createCodigoRecuperacion(normalizedEmail, clientIp);

      // Enviar email con codigo
      const emailSent = await sendPasswordResetEmail({
        email: normalizedEmail,
        codigo,
        nombre: user.first_name,
      });

      if (!emailSent) {
        console.error(`[PasswordReset] Error enviando email a ${normalizedEmail}`);
      }

      console.log(`[PasswordReset] Codigo generado para ${normalizedEmail}`);

      const response: SolicitarRecuperacionResult = {
        success: true,
        message: 'Si el email existe, recibiras un codigo de recuperacion',
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[PasswordReset] Error en solicitarCodigo:', error);
      // Por seguridad, respondemos OK incluso en caso de error
      const response: SolicitarRecuperacionResult = {
        success: true,
        message: 'Si el email existe, recibiras un codigo de recuperacion',
      };
      res.status(200).json(response);
    }
  }

  /**
   * POST /auth/establecer-password (protegido)
   * Establece contraseña para usuarios que no la tienen (ej: acceso via magic link)
   */
  static async establecerPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { password } = req.body ?? {};

      if (!password || password.length < MIN_PASSWORD_LENGTH) {
        res.status(400).json({ error: 'PASSWORD_MUY_CORTA' });
        return;
      }

      const userId = req.user!.id;

      const tienePassword = await checkUsuarioTienePassword(userId);
      if (tienePassword) {
        res.status(400).json({ error: 'PASSWORD_YA_ESTABLECIDA' });
        return;
      }

      await updateUserPassword(userId, password);

      res.json({ ok: true });
    } catch (error: any) {
      console.error('[PasswordReset] Error en establecerPassword:', error);
      res.status(500).json({ error: 'ERROR_SERVIDOR' });
    }
  }

  /**
   * POST /auth/reset-password
   * Valida el codigo y restablece la contrasena
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as ResetPasswordPayload;

      // Validar email
      if (!payload.email?.trim() || !isValidEmail(payload.email)) {
        res.status(400).json(createErrorResponse('Email no valido', 'CODIGO_INVALIDO'));
        return;
      }

      // Validar codigo
      if (!payload.codigo?.trim() || payload.codigo.length !== 6) {
        res.status(400).json(createErrorResponse('Codigo no valido', 'CODIGO_INVALIDO'));
        return;
      }

      // Validar contrasena
      if (!payload.nuevaPassword || payload.nuevaPassword.length < MIN_PASSWORD_LENGTH) {
        res.status(400).json(createErrorResponse(
          `La contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
          'PASSWORD_MUY_CORTA'
        ));
        return;
      }

      const normalizedEmail = payload.email.toLowerCase().trim();

      // Validar codigo de recuperacion
      const validacion = await validarCodigoRecuperacion(normalizedEmail, payload.codigo.trim());

      if (!validacion.valido) {
        const errorMessages: Record<string, { message: string; code: RecuperacionErrorCode }> = {
          CODIGO_INVALIDO: { message: 'El codigo no es valido', code: 'CODIGO_INVALIDO' },
          CODIGO_EXPIRADO: { message: 'El codigo ha expirado. Solicita uno nuevo', code: 'CODIGO_EXPIRADO' },
          INTENTOS_AGOTADOS: { message: 'Demasiados intentos. Solicita un nuevo codigo', code: 'INTENTOS_AGOTADOS' },
        };
        const errorInfo = errorMessages[validacion.error || 'CODIGO_INVALIDO'];
        res.status(400).json(createErrorResponse(errorInfo.message, errorInfo.code));
        return;
      }

      // Buscar usuario por email
      const user = await getUserByEmail(normalizedEmail);
      if (!user) {
        res.status(400).json(createErrorResponse('No se pudo actualizar la contrasena', 'CODIGO_INVALIDO'));
        return;
      }

      // Actualizar contrasena
      await updateUserPassword(user.id, payload.nuevaPassword);

      // Marcar codigo como usado
      if (validacion.codigoId) {
        await marcarCodigoUsado(validacion.codigoId);
      }

      console.log(`[PasswordReset] Contrasena actualizada para ${normalizedEmail}`);

      const response: ResetPasswordResult = {
        success: true,
        message: 'Tu contrasena ha sido actualizada correctamente',
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[PasswordReset] Error en resetPassword:', error);
      res.status(500).json(createErrorResponse('Error interno del servidor', 'SERVER_ERROR'));
    }
  }
}
