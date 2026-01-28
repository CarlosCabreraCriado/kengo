/**
 * Tipos de base de datos para rutinas (plantillas)
 * Reflejan exactamente la estructura de las tablas rutinas, rutinas_ejercicios
 */

import { UUID, DiaSemana } from '../types/common';

/**
 * Visibilidad de una rutina según la BD
 */
export type VisibilidadRutinaDB = 'privado' | 'clinica';

/**
 * Tabla: rutinas
 * Plantillas de ejercicios reutilizables
 */
export interface RutinaDB {
  id_rutina: number;
  user_created: UUID | null;
  date_created: string | null;
  user_updated: UUID | null;
  date_updated: string | null;
  nombre: string | null;
  descripcion: string | null;
  autor: UUID | null;
  visibilidad: string | null;
}

/**
 * Tabla: rutinas_ejercicios
 * Ejercicios incluidos en una rutina con su configuración
 */
export interface RutinaEjercicioDB {
  id: number;
  sort: number | null;
  date_created: string | null;
  date_updated: string | null;
  rutina: number | null;
  ejercicio: number | null;
  series: number | null;
  repeticiones: number | null;
  duracion_seg: number | null;
  descanso_seg: number | null;
  veces_dia: number | null;
  dias_semana: DiaSemana[] | null;
  instrucciones_paciente: string | null;
  notas_fisio: string | null;
}
