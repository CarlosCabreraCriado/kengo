/**
 * Tipos de dominio para usuarios
 * Tipos transformados y listos para usar en las aplicaciones
 */

import { UUID } from '../types/common';

/**
 * Puesto dentro de una clínica (alineado con clinicMemberships.puesto en Convex).
 */
export type Puesto = 'fisio' | 'paciente' | 'admin';

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
 * Relación usuario-clínica transformada (con puesto único)
 */
export interface ClinicaUsuario {
  clinicId: string;
  puesto: Puesto | null;
}

/**
 * Usuario transformado para uso en la aplicación
 */
export interface Usuario {
  id: UUID;
  /** ID de Convex (_id) — disponible cuando el usuario se cargó desde Convex */
  convexId?: string;
  avatar: string;
  first_name: string;
  last_name: string;
  email: string;
  email_verified: boolean;
  detalle: DetalleUsuario | null;
  telefono?: string;
  direccion?: string;
  avatar_url?: string;
  magic_link_url?: string;
  clinicas: ClinicaUsuario[];
  postal?: string;
  /** @computed Derivado de clinicas[].puesto - true si fisio o admin en alguna clínica */
  esFisio: boolean;
  /** @computed Derivado de clinicas[].puesto - true si paciente en alguna clínica o sin acceso fisio */
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
  numero_colegiado?: string | null;
}

/**
 * Permisos de acceso del usuario
 */
export interface Accesos {
  isPaciente: boolean;
  isFisio: boolean;
}
