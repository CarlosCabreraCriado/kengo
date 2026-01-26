/**
 * Tipos de dominio para usuarios
 * Tipos transformados y listos para usar en las aplicaciones
 */

import { UUID } from '../types/common';

/**
 * Constantes de puestos dentro de una clínica
 */
export const PUESTO_FISIOTERAPEUTA = 1;
export const PUESTO_PACIENTE = 2;
export const PUESTO_ADMINISTRADOR = 4;

/**
 * Detalle de usuario transformado
 */
export interface DetalleUsuario {
  dni: string;
  telefono: string;
  direccion: string;
  postal: string;
}

/**
 * Puesto dentro de una clínica
 */
export interface Puesto {
  id_puesto: number;
  puesto: string;
}

/**
 * Relación usuario-clínica transformada
 */
export interface ClinicaUsuario {
  id_clinica: number;
  puestos: Puesto[];
}

/**
 * Usuario transformado para uso en la aplicación
 */
export interface Usuario {
  id: UUID;
  avatar: string;
  first_name: string;
  last_name: string;
  email: string;
  detalle: DetalleUsuario | null;
  telefono?: string;
  direccion?: string;
  avatar_url?: string;
  magic_link_url?: string;
  clinicas: ClinicaUsuario[];
  postal?: string;
  esFisio: boolean;
  esPaciente: boolean;
  numero_colegiado?: string;
}

/**
 * Datos de usuario para uso en backend (PDF, reportes)
 */
export interface UserData {
  id: UUID;
  first_name: string;
  last_name: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
}

/**
 * Permisos de acceso del usuario
 */
export interface Accesos {
  isPaciente: boolean;
  isFisio: boolean;
}
