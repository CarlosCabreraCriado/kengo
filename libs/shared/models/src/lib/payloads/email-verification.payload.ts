/**
 * DTOs (Data Transfer Objects) para operaciones de verificación de email
 * Usados para solicitar códigos de verificación y verificar emails
 */

/**
 * Payload para solicitar un código de verificación
 * No requiere body ya que el email se obtiene del usuario autenticado
 */
export interface EnviarVerificacionPayload {
  // No requiere campos - el email se obtiene de la sesión
}

/**
 * Payload para verificar el email con el código
 */
export interface VerificarEmailPayload {
  codigo: string;
}

/**
 * Códigos de error posibles en verificación de email
 */
export type VerificacionEmailErrorCode =
  | 'CODIGO_INVALIDO'
  | 'CODIGO_EXPIRADO'
  | 'INTENTOS_AGOTADOS'
  | 'EMAIL_YA_VERIFICADO'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVER_ERROR';

/**
 * Resultado de solicitud de verificación
 */
export interface EnviarVerificacionResult {
  success: boolean;
  message?: string;
  code?: VerificacionEmailErrorCode;
}

/**
 * Resultado de verificación de email
 */
export interface VerificarEmailResult {
  success: boolean;
  message?: string;
  code?: VerificacionEmailErrorCode;
}
