/**
 * Tipos de dominio para clínicas
 * Tipos transformados y listos para usar en las aplicaciones
 */

/**
 * Imagen de galería de clínica.
 */
export interface ClinicaImagen {
  /** Convex ID de la fila en `clinicFiles` (string opaco) */
  id: string;
  /** R2 key, ej. `clinic-files/<uuid>.<ext>` */
  fileId: string;
}

/**
 * Clínica transformada para uso en la aplicación
 */
export interface Clinica {
  id_clinica: string;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  postal?: string | null;
  nif?: string | null;
  color_primario?: string | null;
  color_secundario?: string | null;
  logo?: string | null;
  imagenes?: ClinicaImagen[] | null;
}

/**
 * Datos de clínica para uso en backend (PDF, reportes)
 */
export interface ClinicaData {
  id_clinica: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  postal: string | null;
  logo: string | null;
  color_primario: string | null;
  color_secundario: string | null;
}
