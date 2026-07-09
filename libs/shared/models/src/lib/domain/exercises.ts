/**
 * Tipos de dominio para ejercicios.
 * Los IDs son Convex Ids (strings) en todos los casos.
 */

import { UUID } from '../types/common';

/**
 * Métrica por serie de un ejercicio:
 * - `repeticiones`: se cuenta un número de repeticiones (por defecto).
 * - `duracion`: se sostiene durante un tiempo (temporizado, p. ej. plancha).
 */
export type TipoEjercicio = 'repeticiones' | 'duracion';

export interface Ejercicio {
  id: string;
  categoria: string[];
  nombre: string;
  descripcion: string;
  /** `undefined` se interpreta como `'repeticiones'` durante la migración. */
  tipo?: TipoEjercicio;
  repeticionesDefecto?: number;
  seriesDefecto?: number;
  duracionDefectoSeg?: number;
  video: string;
  portada: string;
  videoUrl?: string;
  portadaUrl?: string;
}

export interface Categoria {
  id: string;
  nombre: string;
}

export interface EjercicioFavorito {
  id: string;
  userId: UUID;
  ejercicioId: string;
}
