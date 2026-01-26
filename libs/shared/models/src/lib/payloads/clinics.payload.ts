/**
 * DTOs (Data Transfer Objects) para operaciones de clínicas
 * Usados para crear clínicas, vincular usuarios y gestionar códigos de acceso
 */

import { TipoCodigoAcceso } from '../domain/access-codes';

/**
 * Payload para crear una nueva clínica
 */
export interface CreateClinicaPayload {
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  postal?: string;
  nif?: string;
  color_primario?: string;
}

/**
 * Payload para vincular usuario a clínica mediante código
 */
export interface VincularClinicaPayload {
  codigo: string;
}

/**
 * Respuesta al vincular usuario a clínica
 */
export interface VincularClinicaResponse {
  success: boolean;
  clinicaId?: number;
  nombreClinica?: string;
  tipo?: TipoCodigoAcceso;
  error?: string;
}

/**
 * Respuesta al crear una clínica
 */
export interface CrearClinicaResponse {
  success: boolean;
  clinicaId?: number;
  error?: string;
}

/**
 * Payload para generar un nuevo código de acceso
 */
export interface GenerarCodigoPayload {
  id_clinica: number;
  tipo: TipoCodigoAcceso;
  usos_maximos?: number | null;
  dias_expiracion?: number | null;
}

/**
 * Respuesta al generar un código de acceso
 */
export interface GenerarCodigoResponse {
  success: boolean;
  codigo?: string;
  error?: string;
}
