/**
 * Tipos para respuestas del SDK Directus - Ejercicios
 * Representan la estructura que devuelve el SDK al consultar ejercicios
 */

import { ID, UUID } from '../types/common';

/**
 * Ejercicio como viene del SDK Directus
 */
export interface EjercicioDirectus {
  id_ejercicio: number;
  categoria: string[];
  nombre_ejercicio: string;
  descripcion: string;
  repeticiones_defecto: string;
  series_defecto: string;
  video: UUID | null;
  portada: UUID | null;
  video_url?: string;
  portada_url?: string;
}

/**
 * Categoría como viene del SDK Directus
 */
export interface CategoriaDirectus {
  id_categoria: number;
  nombre_categoria: string;
}

/**
 * Ejercicio favorito como viene del SDK Directus
 */
export interface EjercicioFavoritoDirectus {
  id: number;
  id_usuario: UUID;
  id_ejercicio: number;
}
