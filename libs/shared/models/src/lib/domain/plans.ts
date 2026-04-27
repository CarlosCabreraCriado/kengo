/**
 * Tipos de dominio para planes de tratamiento
 * Tipos transformados y listos para usar en las aplicaciones
 */

import { DiaSemana, UUID } from '../types/common';
import { Usuario } from './users';
import { Ejercicio } from './exercises';

// Re-export de EstadoPlan desde records/plans.record
export { EstadoPlan } from '../records/plans.record';

/**
 * Plan transformado para uso en la aplicación
 */
export interface Plan {
  id_plan: string;
  paciente: UUID | Usuario;
  fisio: UUID | Usuario;
  titulo: string;
  descripcion?: string;
  estado: 'borrador' | 'activo' | 'completado' | 'cancelado';
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  date_created?: string;
  date_updated?: string;
  plan_anterior?: string | null;
  version?: number;
}

/**
 * Plan con todos los datos expandidos
 */
export interface PlanCompleto extends Plan {
  paciente: Usuario;
  fisio: Usuario;
  items: EjercicioPlan[];
}

/**
 * Ejercicio dentro de un plan
 */
export interface EjercicioPlan {
  id?: string;
  sort: number;
  date_created?: string;
  date_updated?: string;
  plan?: string;
  ejercicio: Ejercicio;
  instrucciones_paciente?: string;
  notas_fisio?: string;
  series?: number;
  repeticiones?: number;
  duracion_seg?: number;
  descanso_seg?: number;
  veces_dia?: number;
  dias_semana?: DiaSemana[];
}

export interface RegistroEjercicio {
  id_registro?: string;
  plan_item: string;
  paciente: UUID;
  fecha_hora: string;
  completado: boolean;
  repeticiones_realizadas?: number;
  duracion_real_seg?: number;
  dolor_escala?: number;
  esfuerzo_escala?: number;
  nota_paciente?: string;
}

export interface PlanData {
  id_plan: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  fecha_inicio: Date | null;
  fecha_fin: Date | null;
  paciente: UUID;
  fisio: UUID;
}

export interface EjercicioPlanData {
  id: string;
  sort: number | null;
  series: number;
  repeticiones: number;
  duracion_seg: number | null;
  descanso_seg: number | null;
  veces_dia: number;
  dias_semana: string | null;
  instrucciones_paciente: string | null;
  notas_fisio: string | null;
  id_ejercicio: string;
  nombre_ejercicio: string;
  ejercicio_descripcion: string | null;
  portada: string | null;
}
