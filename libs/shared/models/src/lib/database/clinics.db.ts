/**
 * Tipos de base de datos para clínicas
 * Reflejan exactamente la estructura de las tablas clinicas, usuarios_clinicas, etc.
 */

import { UUID } from '../types/common';

/**
 * Tabla: clinicas
 * Información de clínicas de fisioterapia
 */
export interface ClinicaDB {
  id_clinica: number;
  user_created: UUID | null;
  date_created: string | null;
  user_updated: UUID | null;
  date_updated: string | null;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  postal: string | null;
  nif: string | null;
  logo: UUID | null;
  color_primario: string | null;
  color_secundario: string | null;
}

/**
 * Tabla: usuarios_clinicas
 * Relación entre usuarios y clínicas
 */
export interface UsuarioClinicaDB {
  id: number;
  id_usuario: UUID | null;
  id_clinica: number | null;
}

/**
 * Tabla: usuarios_clinicas_Puestos
 * Relación entre usuarios_clinicas y puestos
 */
export interface UsuarioClinicaPuestoDB {
  id: number;
  usuarios_clinicas_id: number | null;
  Puestos_id: number | null;
}

/**
 * Tabla: clinicas_files
 * Archivos asociados a clínicas (imágenes, documentos)
 */
export interface ClinicaFilesDB {
  id: number;
  clinicas_id_clinica: number | null;
  directus_files_id: UUID | null;
}
