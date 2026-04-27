/**
 * DTOs (Data Transfer Objects) para operaciones de planes
 * Usados para crear y actualizar planes de tratamiento
 */

import { DiaSemana, UUID } from '../types/common';
import { EstadoPlan } from '../records/plans.record';

/**
 * Payload para crear un nuevo plan
 */
export interface CreatePlanPayload {
  paciente: UUID;
  fisio: UUID;
  titulo: string;
  descripcion?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estado?: EstadoPlan;
  items: CreatePlanEjercicioPayload[];
}

/**
 * Payload para crear un ejercicio dentro de un plan
 */
export interface CreatePlanEjercicioPayload {
  ejercicio: string;
  sort: number;
  series?: number;
  repeticiones?: number;
  duracionSeg?: number;
  descansoSeg?: number;
  vecesDia?: number;
  diasSemana?: DiaSemana[];
  instruccionesPaciente?: string;
  notasFisio?: string;
}

/**
 * Payload para actualizar un plan existente
 */
export interface UpdatePlanPayload {
  titulo?: string;
  descripcion?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estado?: EstadoPlan;
}

/**
 * Payload para actualizar un ejercicio de plan
 */
export interface UpdatePlanEjercicioPayload {
  sort?: number;
  series?: number;
  repeticiones?: number;
  duracionSeg?: number;
  descansoSeg?: number;
  vecesDia?: number;
  diasSemana?: DiaSemana[];
  instruccionesPaciente?: string;
  notasFisio?: string;
}

/**
 * Payload para crear un registro de ejercicio completado
 */
export interface CreateRegistroEjercicioPayload {
  planItemId: string;
  paciente: UUID;
  fechaHora: string;
  completado: boolean;
  repeticionesRealizadas?: number;
  duracionRealSeg?: number;
  dolorEscala?: number;
  esfuerzoEscala?: number;
  notaPaciente?: string;
}
