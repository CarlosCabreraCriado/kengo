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
  id: string;
  nombre: string;
  descripcion?: string;
  autor: UUID | Usuario;
  visibilidad: 'privado' | 'clinica';
  dateCreated?: string;
  dateUpdated?: string;
}

export interface RutinaCompleta extends Rutina {
  autor: Usuario;
  ejercicios: EjercicioRutina[];
}

export interface EjercicioRutina {
  id: string;
  sort: number;
  rutinaId: string;
  ejercicio: Ejercicio;
  series?: number;
  repeticiones?: number;
  duracionSeg?: number;
  descansoSeg?: number;
  diasSemana?: DiaSemana[];
  instruccionesPaciente?: string;
  notasFisio?: string;
  dateCreated?: string;
  dateUpdated?: string;
}
