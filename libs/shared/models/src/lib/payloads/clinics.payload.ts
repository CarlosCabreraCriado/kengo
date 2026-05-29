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
  nombreComercial?: string;
  telefono?: string;
  email?: string;
  web?: string;
  direccion?: string;
  postal?: string;
  nif?: string;
  colorPrimario?: string;
  /** R2 key del logo (`logos/<uuid>.<ext>`) ya subida, a vincular en la creación */
  logo?: string;
  /** R2 keys ya subidas (`clinic-files/<uuid>.<ext>`) a vincular como galería */
  addImageKeys?: string[];
}

/**
 * Payload para actualizar una clínica existente
 */
export interface UpdateClinicaPayload {
  nombre?: string;
  nombreComercial?: string | null;
  telefono?: string | null;
  email?: string | null;
  web?: string | null;
  direccion?: string | null;
  postal?: string | null;
  nif?: string | null;
  colorPrimario?: string | null;
  /** R2 key del logo (`logos/<uuid>.<ext>`), null para eliminar */
  logo?: string | null;
  /** Operaciones sobre la galería de imágenes (`clinicFiles`) */
  imagenes?: {
    /** R2 keys ya subidas (`clinic-files/<uuid>.<ext>`) a vincular */
    create?: string[];
    /** Convex IDs de `clinicFiles` a eliminar */
    delete?: string[];
  };
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
  clinicaId?: string;
  nombreClinica?: string;
  tipo?: TipoCodigoAcceso;
  /** `true` si el canje promovió una membresía de paciente a fisio. */
  promovido?: boolean;
  error?: string;
}

/**
 * Respuesta al crear una clínica
 */
export interface CrearClinicaResponse {
  success: boolean;
  clinicaId?: string;
  error?: string;
}

/**
 * Payload para generar un nuevo código de acceso
 */
export interface GenerarCodigoPayload {
  clinicId: string;
  tipo: TipoCodigoAcceso;
  usosMaximos?: number | null;
  diasExpiracion?: number | null;
  email?: string | null;
}

/**
 * Respuesta al generar un código de acceso
 */
export interface GenerarCodigoResponse {
  success: boolean;
  codigo?: string;
  emailEnviado?: boolean;
  error?: string;
  /** Código del error original (p. ej. `REQUIERE_CONTACTO_VENTAS`). */
  errorCode?: string;
}
