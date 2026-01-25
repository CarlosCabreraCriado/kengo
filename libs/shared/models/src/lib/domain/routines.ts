/**
 * Tipos de dominio para rutinas (plantillas)
 * Tipos transformados y listos para usar en las aplicaciones
 */

import { DiaSemana, UUID } from '../types/common';
import { Usuario } from './users';
import { Ejercicio } from './exercises';

// Re-exportar VisibilidadRutina desde directus para mantener compatibilidad
export { VisibilidadRutina } from '../directus/routines.directus';

/**
 * Rutina transformada para uso en la aplicación
 */
export interface Rutina {
  id_rutina: number;
  nombre: string;
  descripcion?: string;
  autor: UUID | Usuario;
  visibilidad: 'privado' | 'publico';
  date_created?: string;
  date_updated?: string;
}

/**
 * Rutina con todos los datos expandidos
 */
export interface RutinaCompleta extends Rutina {
  autor: Usuario;
  ejercicios: EjercicioRutina[];
}

/**
 * Ejercicio dentro de una rutina
 */
export interface EjercicioRutina {
  id: number;
  sort: number;
  rutina: number;
  ejercicio: Ejercicio;
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
