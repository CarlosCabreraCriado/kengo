/**
 * Tipos de base de datos para planes de tratamiento
 * Reflejan exactamente la estructura de las tablas Planes, planes_ejercicios, planes_registros
 */

import { UUID, DiaSemana } from '../types/common';

/**
 * Estados posibles de un plan según la BD
 * Nota: 'cancelado' existe en frontend pero NO en BD (DEFAULT 'borrador')
 */
export type EstadoPlanDB = 'borrador' | 'activo' | 'completado';

/**
 * Tabla: Planes
 * Plan de tratamiento asignado a un paciente
 */
export interface PlanDB {
  id_plan: number;
  user_created: UUID | null;
  date_created: string | null;
  user_updated: UUID | null;
  date_updated: string | null;
  titulo: string | null;
  descripcion: string | null;
  estado: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  paciente: UUID | null;
  fisio: UUID | null;
}

/**
 * Tabla: planes_ejercicios
 * Ejercicios incluidos en un plan con su configuración
 */
export interface PlanEjercicioDB {
  id: number;
  sort: number | null;
  date_created: string | null;
  date_updated: string | null;
  plan: number | null;
  ejercicio: number | null;
  instrucciones_paciente: string | null;
  notas_fisio: string | null;
  series: number | null;
  repeticiones: number | null;
  duracion_seg: number | null;
  descanso_seg: number | null;
  veces_dia: number | null;
  dias_semana: DiaSemana[] | null;
}

/**
 * Tabla: planes_registros
 * Registro de ejecución de ejercicios por pacientes
 */
export interface PlanRegistroDB {
  id_registro: number;
  date_created: string | null;
  plan_item: number | null;
  paciente: UUID | null;
  fecha_hora: string | null;
  completado: boolean | null;
  repeticiones_realizadas: number;
  duracion_real_seg: number | null;
  dolor_escala: number | null;
  esfuerzo_escala: number | null;
  nota_paciente: string | null;
}
