/**
 * DTOs (Data Transfer Objects) para operaciones de planes
 * Usados para crear y actualizar planes de tratamiento
 */

import { DiaSemana, UUID } from '../types/common';
import { EstadoPlan } from '../directus/plans.directus';

/**
 * Payload para crear un nuevo plan
 */
export interface CreatePlanPayload {
  paciente: UUID;
  fisio: UUID;
  titulo: string;
  descripcion?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  estado?: EstadoPlan;
  items: CreatePlanEjercicioPayload[];
}

/**
 * Payload para crear un ejercicio dentro de un plan
 */
export interface CreatePlanEjercicioPayload {
  ejercicio: number;
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
 * Payload para actualizar un plan existente
 */
export interface UpdatePlanPayload {
  titulo?: string;
  descripcion?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  estado?: EstadoPlan;
}

/**
 * Payload para actualizar un ejercicio de plan
 */
export interface UpdatePlanEjercicioPayload {
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

/**
 * Payload para crear un registro de ejercicio completado
 */
export interface CreateRegistroEjercicioPayload {
  plan_item: number;
  paciente: UUID;
  fecha_hora: string;
  completado: boolean;
  repeticiones_realizadas?: number;
  duracion_real_seg?: number;
  dolor_escala?: number;
  esfuerzo_escala?: number;
  nota_paciente?: string;
}
