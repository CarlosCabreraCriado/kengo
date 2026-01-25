/**
 * Tipos para respuestas del SDK Directus - Clínicas
 * Representan la estructura que devuelve el SDK al consultar clínicas
 */

import { ID } from '../types/common';

/**
 * Clínica como viene del SDK Directus
 */
export interface ClinicaDirectus {
  id_clinica: ID;
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  postal?: string | null;
  nif?: string | null;
  color_primario?: string | null;
  color_secundario?: string | null;
  logo?: { id: ID } | null;
  imagenes?: { directus_files_id: ID }[] | null;
}
