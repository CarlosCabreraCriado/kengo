/**
 * DTOs (Data Transfer Objects) para operaciones de rutinas
 * Usados para crear y actualizar rutinas (plantillas)
 */

import { DiaSemana, UUID } from '../types/common';

export type VisibilidadRutina = 'privado' | 'clinica';

/**
 * Payload para crear una nueva rutina
 */
export interface CreateRutinaPayload {
  nombre: string;
  descripcion?: string;
  autor: UUID;
  visibilidad: VisibilidadRutina;
  ejercicios: CreateRutinaEjercicioPayload[];
}

/**
 * Payload para crear un ejercicio dentro de una rutina
 */
export interface CreateRutinaEjercicioPayload {
  ejercicio: string;
  sort: number;
  series?: number;
  repeticiones?: number;
  duracion_seg?: number;
  descanso_seg?: number;
  veces_dia?: number;
  dias_semana?: DiaSemana[];
  instrucciones_paciente?: string;
  notas_fisio?: string;
}

/**
 * Payload para actualizar una rutina existente
 */
export interface UpdateRutinaPayload {
  nombre?: string;
  descripcion?: string;
  visibilidad?: VisibilidadRutina;
}

/**
 * Payload para actualizar un ejercicio de rutina
 */
export interface UpdateRutinaEjercicioPayload {
  sort?: number;
  series?: number;
  repeticiones?: number;
  duracion_seg?: number;
  descanso_seg?: number;
  veces_dia?: number;
  dias_semana?: DiaSemana[];
  instrucciones_paciente?: string;
  notas_fisio?: string;
}
