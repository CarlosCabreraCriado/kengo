/**
 * Tipos para respuestas del SDK Directus - Planes
 * Representan la estructura que devuelve el SDK al consultar planes
 */

import { DiaSemana } from '../types/common';
import { UsuarioDirectus } from './users.directus';
import { Ejercicio } from '../domain/exercises';

/**
 * Estado del plan (incluye 'cancelado' para compatibilidad con frontend)
 * Nota: 'cancelado' existe en frontend pero NO está definido en BD
 */
export type EstadoPlan = 'borrador' | 'activo' | 'completado' | 'cancelado';

/**
 * Plan como viene del SDK Directus
 */
export interface PlanDirectus {
  id_plan: number;
  paciente: string | UsuarioDirectus;
  fisio: string | UsuarioDirectus;
  titulo: string;
  descripcion?: string;
  estado: EstadoPlan;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  date_created?: string;
  date_updated?: string;
  ejercicios?: EjercicioPlanDirectus[];
}

/**
 * Ejercicio de plan como viene del SDK Directus
 */
export interface EjercicioPlanDirectus {
  id: number;
  sort: number;
  date_created?: string;
  date_updated?: string;
  plan: number;
  ejercicio: number | Ejercicio;
  instrucciones_paciente?: string;
  notas_fisio?: string;
  series?: number;
  repeticiones?: number;
  duracion_seg?: number;
  descanso_seg?: number;
  veces_dia?: number;
  dias_semana?: DiaSemana[];
}

/**
 * Registro de ejercicio como viene del SDK Directus
 */
export interface RegistroEjercicioDirectus {
  id_registro: number;
  plan_item: number | { id: number };
  paciente: string | UsuarioDirectus;
  fecha_hora: string;
  completado: boolean;
  repeticiones_realizadas?: number;
  duracion_real_seg?: number;
  dolor_escala?: number;
  esfuerzo_escala?: number;
  nota_paciente?: string;
}
