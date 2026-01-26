import { Request, Response } from 'express';
import {
  checkEmailExists,
  getClinicaByCode,
  createUserInDirectus,
  createUsuarioClinica,
} from '../models/directus';
import { sendWelcomeEmail } from '../services/email.service';
import type {
  CreateUsuarioPayload,
  RegistroResult,
  RegistroErrorCode,
} from '@kengo/shared-models';

// Roles de Directus (configurar en .env)
const ROL_FISIO_ID = process.env.ROL_FISIO_ID;
const ROL_PACIENTE_ID = process.env.ROL_PACIENTE_ID;

// Puesto en tabla usuarios_clinicas (2 = paciente, ajustar segun tu esquema)
const PUESTO_FISIO = 1;
const PUESTO_PACIENTE = 2;

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function createErrorResponse(error: string, code: RegistroErrorCode): RegistroResult {
  return { success: false, error, code };
}

export class registroController {
  static async registrar(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as CreateUsuarioPayload;

      // 1. Validar campos requeridos
      if (!payload.first_name?.trim()) {
        res.status(400).json(createErrorResponse('El nombre es requerido', 'VALIDATION_ERROR'));
        return;
      }
      if (!payload.last_name?.trim()) {
        res.status(400).json(createErrorResponse('Los apellidos son requeridos', 'VALIDATION_ERROR'));
        return;
      }
      if (!payload.email?.trim()) {
        res.status(400).json(createErrorResponse('El email es requerido', 'VALIDATION_ERROR'));
        return;
      }
      if (!isValidEmail(payload.email)) {
        res.status(400).json(createErrorResponse('El formato del email no es valido', 'VALIDATION_ERROR'));
        return;
      }
      if (!payload.password || payload.password.length < 6) {
        res.status(400).json(createErrorResponse('La contrasena debe tener al menos 6 caracteres', 'VALIDATION_ERROR'));
        return;
      }
      if (!payload.tipo || !['fisioterapeuta', 'paciente'].includes(payload.tipo)) {
        res.status(400).json(createErrorResponse('El tipo de usuario no es valido', 'VALIDATION_ERROR'));
        return;
      }

      // 2. Verificar email no duplicado
      const emailExists = await checkEmailExists(payload.email);
      if (emailExists) {
        res.status(409).json(createErrorResponse('Este email ya esta registrado', 'EMAIL_DUPLICADO'));
        return;
      }

      // 3. Validar codigo de clinica si se proporciona
      let clinica: { id: string | number; nombre: string } | null = null;
      if (payload.codigo_clinica?.trim()) {
        clinica = await getClinicaByCode(payload.codigo_clinica.trim());
        if (!clinica) {
          res.status(404).json(createErrorResponse('El codigo de clinica no es valido', 'CLINICA_NO_ENCONTRADA'));
          return;
        }
      }

      // 4. Determinar rol segun tipo
      const roleId = payload.tipo === 'fisioterapeuta' ? ROL_FISIO_ID : ROL_PACIENTE_ID;
      if (!roleId) {
        console.error(`[Registro] Falta configurar ROL_${payload.tipo.toUpperCase()}_ID en .env`);
        res.status(500).json(createErrorResponse('Error de configuracion del servidor', 'SERVER_ERROR'));
        return;
      }

      // 5. Crear usuario en Directus
      const { id: userId } = await createUserInDirectus({
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        email: payload.email.toLowerCase().trim(),
        password: payload.password,
        role: roleId,
      });

      // 6. Crear relacion usuario-clinica si aplica
      if (clinica) {
        const puesto = payload.tipo === 'fisioterapeuta' ? PUESTO_FISIO : PUESTO_PACIENTE;
        await createUsuarioClinica(userId, clinica.id, puesto);
      }

      // 7. Enviar email de bienvenida (no bloquea el registro)
      sendWelcomeEmail({
        email: payload.email,
        nombre: payload.first_name,
        tipo: payload.tipo,
      }).catch(err => {
        console.error('[Registro] Error enviando email de bienvenida:', err);
      });

      // 8. Respuesta exitosa
      const response: RegistroResult = {
        success: true,
        message: 'Usuario registrado exitosamente',
        userId,
      };

      res.status(201).json(response);
    } catch (error: any) {
      console.error('[Registro] Error:', error);
      res.status(500).json(createErrorResponse('Error interno del servidor', 'SERVER_ERROR'));
    }
  }
}
