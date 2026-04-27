/**
 * Tipos de dominio para ejercicios.
 * Los IDs son Convex Ids (strings) en todos los casos.
 */

import { UUID } from '../types/common';

export interface Ejercicio {
  id_ejercicio: string;
  categoria: string[];
  nombre_ejercicio: string;
  descripcion: string;
  repeticiones_defecto: string;
  series_defecto: string;
  video: string;
  portada: string;
  video_url?: string;
  portada_url?: string;
}

export interface Categoria {
  id_categoria: string;
  nombre_categoria: string;
}

export interface EjercicioFavorito {
  id: string;
  id_usuario: UUID;
  id_ejercicio: string;
}
