/**
 * Tipos de dominio para clínicas
 * Tipos transformados y listos para usar en las aplicaciones
 */

/**
 * Imagen de galería de clínica con ID de junction para operaciones M2M
 */
export interface ClinicaImagen {
  /** ID del registro en la tabla junction (clinicas_files) */
  junctionId: number;
  /** UUID del archivo en directus_files */
  fileId: string;
}

/**
 * Clínica transformada para uso en la aplicación
 */
export interface Clinica {
  id_clinica: number;
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
  id_clinica: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  postal: string | null;
  logo: string | null;
  color_primario: string | null;
  color_secundario: string | null;
}
