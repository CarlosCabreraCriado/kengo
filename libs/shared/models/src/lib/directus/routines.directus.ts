/**
 * Tipos para respuestas del SDK Directus - Rutinas
 * Representan la estructura que devuelve el SDK al consultar rutinas
 */

import { DiaSemana } from '../types/common';
import { UsuarioDirectus } from './users.directus';
import { Ejercicio } from '../domain/exercises';

/**
 * Visibilidad de rutina
 */
export type VisibilidadRutina = 'privado' | 'publico';

/**
 * Rutina como viene del SDK Directus
 */
export interface RutinaDirectus {
  id_rutina: number;
  nombre: string;
  descripcion?: string;
  autor: string | UsuarioDirectus;
  visibilidad: VisibilidadRutina;
  date_created?: string;
  date_updated?: string;
  ejercicios?: EjercicioRutinaDirectus[];
}

/**
 * Ejercicio de rutina como viene del SDK Directus
 */
export interface EjercicioRutinaDirectus {
  id: number;
  sort: number;
  rutina: number;
  ejercicio: number | Ejercicio;
  series?: number;
  repeticiones?: number;
  duracion_seg?: number;
  descanso_seg?: number;
  veces_dia?: number;
  dias_semana?: DiaSemana[];
  instrucciones_paciente?: string;
  notas_fisio?: string;
  date_created?: string;
  date_updated?: string;
}
