import { Request, Response } from 'express';
import {
  countRecentVerificationRequests,
  createCodigoVerificacion,
  validarCodigoVerificacion,
  marcarCodigoVerificacionUsado,
  updateUserEmailVerified,
} from '../models/directus';
import { sendEmailVerificationEmail } from '../services/email.service';
import type { AuthenticatedRequest } from '../middleware/auth';
import type {
  VerificarEmailPayload,
  EnviarVerificacionResult,
  VerificarEmailResult,
  VerificacionEmailErrorCode,
} from '@kengo/shared-models';

// Configuracion de seguridad
const MAX_SOLICITUDES_POR_HORA = 3;

function createErrorResponse(message: string, code: VerificacionEmailErrorCode): VerificarEmailResult {
  return { success: false, message, code };
}

export class emailVerificationController {
  /**
   * POST /auth/enviar-verificacion
   * Envía un código de verificación al email del usuario autenticado
   */
  static async enviarCodigo(req: Request, res: Response): Promise<void> {
    try {
      // El usuario viene del middleware de auth
      const user = (req as AuthenticatedRequest).user;
      if (!user || !user.id) {
        res.status(401).json(createErrorResponse('No autenticado', 'SERVER_ERROR'));
        return;
      }
      if (!user || !user.email) {
        res.status(400).json(createErrorResponse('Usuario no encontrado', 'SERVER_ERROR'));
        return;
      }

      const clientIp = req.ip || req.socket.remoteAddress;

      // Verificar rate limiting
      const recentRequests = await countRecentVerificationRequests(user.email);
      if (recentRequests >= MAX_SOLICITUDES_POR_HORA) {
        console.log(`[EmailVerification] Rate limit excedido para ${user.email}`);
        const response: EnviarVerificacionResult = {
          success: false,
          message: 'Has solicitado demasiados códigos. Inténtalo en una hora.',
          code: 'RATE_LIMIT_EXCEEDED',
        };
        res.status(429).json(response);
        return;
      }

      // Crear código de verificación
      const { codigo } = await createCodigoVerificacion(user.email, clientIp);

      // Enviar email con código
      const emailSent = await sendEmailVerificationEmail({
        email: user.email,
        codigo,
        nombre: user.first_name,
      });

      if (!emailSent) {
        console.error(`[EmailVerification] Error enviando email a ${user.email}`);
        res.status(500).json(createErrorResponse('Error enviando el email', 'SERVER_ERROR'));
        return;
      }

      console.log(`[EmailVerification] Código generado para ${user.email}`);

      const response: EnviarVerificacionResult = {
        success: true,
        message: 'Se ha enviado un código de verificación a tu email',
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[EmailVerification] Error en enviarCodigo:', error);
      res.status(500).json(createErrorResponse('Error interno del servidor', 'SERVER_ERROR'));
    }
  }

  /**
   * POST /auth/verificar-email
   * Valida el código y marca el email como verificado
   */
  static async verificarEmail(req: Request, res: Response): Promise<void> {
    try {
      // El usuario viene del middleware de auth
      const user = (req as AuthenticatedRequest).user;
      if (!user || !user.id) {
        res.status(401).json(createErrorResponse('No autenticado', 'SERVER_ERROR'));
        return;
      }

      if (!user.email) {
        res.status(400).json(createErrorResponse('Usuario no encontrado', 'SERVER_ERROR'));
        return;
      }

      const payload = req.body as VerificarEmailPayload;

      // Validar código
      if (!payload.codigo?.trim() || payload.codigo.length !== 6) {
        res.status(400).json(createErrorResponse('Código no válido', 'CODIGO_INVALIDO'));
        return;
      }

      // Validar código de verificación
      const validacion = await validarCodigoVerificacion(user.email, payload.codigo.trim());

      if (!validacion.valido) {
        const errorMessages: Record<string, { message: string; code: VerificacionEmailErrorCode }> = {
          CODIGO_INVALIDO: { message: 'El código no es válido', code: 'CODIGO_INVALIDO' },
          CODIGO_EXPIRADO: { message: 'El código ha expirado. Solicita uno nuevo', code: 'CODIGO_EXPIRADO' },
          INTENTOS_AGOTADOS: { message: 'Demasiados intentos. Solicita un nuevo código', code: 'INTENTOS_AGOTADOS' },
        };
        const errorInfo = errorMessages[validacion.error || 'CODIGO_INVALIDO'];
        res.status(400).json(createErrorResponse(errorInfo.message, errorInfo.code));
        return;
      }

      // Marcar email como verificado
      await updateUserEmailVerified(user.id, true);

      // Marcar código como usado
      if (validacion.codigoId) {
        await marcarCodigoVerificacionUsado(validacion.codigoId);
      }

      console.log(`[EmailVerification] Email verificado para ${user.email}`);

      const response: VerificarEmailResult = {
        success: true,
        message: 'Tu email ha sido verificado correctamente',
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[EmailVerification] Error en verificarEmail:', error);
      res.status(500).json(createErrorResponse('Error interno del servidor', 'SERVER_ERROR'));
    }
  }
}
