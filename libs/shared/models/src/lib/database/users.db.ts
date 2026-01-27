/**
 * Tipos de base de datos para usuarios
 * Reflejan exactamente la estructura de las tablas directus_users y detalle_usuario
 */

import { UUID } from '../types/common';

/**
 * Tabla: directus_users
 * Usuario del sistema gestionado por Directus
 */
export interface DirectusUserDB {
  id: UUID;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  password: string | null;
  location: string | null;
  title: string | null;
  description: string | null;
  tags: unknown | null;
  avatar: UUID | null;
  language: string | null;
  tfa_secret: string | null;
  status: string;
  role: UUID | null;
  token: string | null;
  last_access: string | null;
  last_page: string | null;
  provider: string;
  external_identifier: string | null;
  auth_data: unknown | null;
  email_notifications: boolean | null;
  appearance: string | null;
  theme_dark: string | null;
  theme_light: string | null;
  theme_light_overrides: unknown | null;
  theme_dark_overrides: unknown | null;
  text_direction: string;
  email_verified: boolean;
  telefono: string | null;
  direccion: string | null;
  postal: string | null;
  magic_link_url: string | null;
  numero_colegiado: string | null;
}

/**
 * Tabla: detalle_usuario
 * Información adicional del usuario (para pacientes)
 */
export interface DetalleUsuarioDB {
  id_detalle_usuario: number;
  id_usuario: UUID | null;
  dni: string | null;
  fecha_nacimiento: string | null;
  direccion: string | null;
  postal: string | null;
  telefono: string | null;
  sexo: string | null;
}

/**
 * Tabla: Puestos
 * Roles/puestos dentro de una clínica
 */
export interface PuestoDB {
  id: number;
  puesto: string | null;
}
