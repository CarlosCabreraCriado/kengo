/**
 * DTOs (Data Transfer Objects) para operaciones de registro de usuarios
 * Usados para crear usuarios y manejar respuestas de registro
 */

/**
 * Payload para crear un nuevo usuario
 */
export interface CreateUsuarioPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  codigo_clinica?: string;
  /**
   * Versión de los textos legales que el usuario aceptó al registrarse
   * (`LEGAL_DOCS[...].version` de `@kengo/legal`). El backend deja constancia
   * del consentimiento con esta versión — sin ella no habría forma de probar
   * qué texto se aceptó.
   */
  consent_version?: string;
}

/**
 * Respuesta exitosa de registro
 */
export interface RegistroResponse {
  success: true;
  message: string;
  userId: string;
}

/**
 * Códigos de error posibles en registro
 */
export type RegistroErrorCode =
  | 'EMAIL_DUPLICADO'
  | 'CLINICA_NO_ENCONTRADA'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR';

/**
 * Respuesta de error de registro
 */
export interface RegistroErrorResponse {
  success: false;
  error: string;
  code: RegistroErrorCode;
}

/**
 * Resultado de registro (éxito o error)
 */
export type RegistroResult = RegistroResponse | RegistroErrorResponse;
