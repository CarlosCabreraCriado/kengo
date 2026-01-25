/**
 * Tipos de dominio para planes de tratamiento
 * Tipos transformados y listos para usar en las aplicaciones
 */

import { DiaSemana, UUID } from '../types/common';
import { Usuario } from './users';
import { Ejercicio } from './exercises';

// Re-exportar EstadoPlan desde directus para mantener compatibilidad
export { EstadoPlan } from '../directus/plans.directus';

/**
 * Plan transformado para uso en la aplicación
 */
export interface Plan {
  id_plan: number;
  paciente: UUID | Usuario;
  fisio: UUID | Usuario;
  titulo: string;
  descripcion?: string;
  estado: 'borrador' | 'activo' | 'completado' | 'cancelado';
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  date_created?: string;
  date_updated?: string;
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
  id?: number;
  sort: number;
  date_created?: string;
  date_updated?: string;
  plan?: number;
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

/**
 * Registro de ejecución de un ejercicio
 * Incluye esfuerzo_escala que existe en BD
 */
export interface RegistroEjercicio {
  id_registro?: number;
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

/**
 * Datos de plan para uso en backend (PDF, reportes)
 */
export interface PlanData {
  id_plan: number;
  titulo: string;
  descripcion: string | null;
  estado: string;
  fecha_inicio: Date | null;
  fecha_fin: Date | null;
  paciente: UUID;
  fisio: UUID;
}

/**
 * Ejercicio de plan para uso en backend (PDF, reportes)
 */
export interface EjercicioPlanData {
  id: number;
  sort: number | null;
  series: number;
  repeticiones: number;
  duracion_seg: number | null;
  descanso_seg: number | null;
  veces_dia: number;
  dias_semana: string | null;
  instrucciones_paciente: string | null;
  notas_fisio: string | null;
  id_ejercicio: number;
  nombre_ejercicio: string;
  ejercicio_descripcion: string | null;
  portada: string | null;
}
