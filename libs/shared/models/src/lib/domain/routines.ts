/**
 * Tipos de dominio para rutinas (plantillas)
 * Tipos transformados y listos para usar en las aplicaciones
 */

import { DiaSemana, UUID } from '../types/common';
import { Usuario } from './users';
import { Ejercicio } from './exercises';

// Re-exportado desde el payload (que es donde se define ahora)
export { VisibilidadRutina } from '../payloads/routines.payload';

/**
 * Rutina transformada para uso en la aplicación
 */
export interface Rutina {
  id_rutina: string;
  nombre: string;
  descripcion?: string;
  autor: UUID | Usuario;
  visibilidad: 'privado' | 'clinica';
  date_created?: string;
  date_updated?: string;
}

export interface RutinaCompleta extends Rutina {
  autor: Usuario;
  ejercicios: EjercicioRutina[];
}

export interface EjercicioRutina {
  id: string;
  sort: number;
  rutina: string;
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
