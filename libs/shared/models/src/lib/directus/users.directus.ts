/**
 * Tipos para respuestas del SDK Directus - Usuarios
 * Representan la estructura que devuelve el SDK al consultar usuarios
 */

import { UUID, ID } from '../types/common';

/**
 * Detalle de usuario como viene de Directus
 */
export interface DetalleUsuarioDirectus {
  dni: string;
  telefono: string;
  direccion: string;
  postal: string;
}

/**
 * Estructura de clínica con puesto como viene de Directus
 */
export interface ClinicaUsuarioDirectus {
  id_clinica: number;
  id_puesto: number | null;
  puesto?: {
    id: number;
    puesto: string;
  };
}

/**
 * Usuario como viene del SDK Directus
 */
export interface UsuarioDirectus {
  id: UUID;
  avatar: string;
  first_name: string;
  last_name: string;
  email: string;
  email_verified?: boolean;
  detalle: DetalleUsuarioDirectus | null;
  avatar_url?: string;
  telefono?: string;
  direccion?: string;
  magic_link_url?: string;
  clinicas: ClinicaUsuarioDirectus[];
  postal?: string;
  numero_colegiado?: string;
}
