/**
 * Tipos de dominio para ejercicios.
 * Los IDs son Convex Ids (strings) en todos los casos.
 */

import { UUID } from '../types/common';

export interface Ejercicio {
  id: string;
  categoria: string[];
  nombre: string;
  descripcion: string;
  repeticionesDefecto?: number;
  seriesDefecto?: number;
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
