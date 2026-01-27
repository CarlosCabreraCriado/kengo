/**
 * DTOs (Data Transfer Objects) para operaciones de recuperación de contraseña
 * Usados para solicitar códigos de recuperación y restablecer contraseñas
 */

/**
 * Payload para solicitar un código de recuperación
 */
export interface SolicitarRecuperacionPayload {
  email: string;
}

/**
 * Payload para restablecer la contraseña
 */
export interface ResetPasswordPayload {
  email: string;
  codigo: string;
  nuevaPassword: string;
}

/**
 * Códigos de error posibles en recuperación de contraseña
 */
export type RecuperacionErrorCode =
  | 'EMAIL_NO_ENCONTRADO'
  | 'CODIGO_INVALIDO'
  | 'CODIGO_EXPIRADO'
  | 'INTENTOS_AGOTADOS'
  | 'PASSWORD_MUY_CORTA'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVER_ERROR';

/**
 * Resultado de solicitud de recuperación
 */
export interface SolicitarRecuperacionResult {
  success: boolean;
  message?: string;
}

/**
 * Resultado de reset de contraseña
 */
export interface ResetPasswordResult {
  success: boolean;
  message?: string;
  code?: RecuperacionErrorCode;
}
