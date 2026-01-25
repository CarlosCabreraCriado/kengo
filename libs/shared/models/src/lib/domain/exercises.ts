/**
 * Tipos de dominio para ejercicios
 * Tipos transformados y listos para usar en las aplicaciones
 */

import { UUID } from '../types/common';

/**
 * Ejercicio transformado para uso en la aplicación
 */
export interface Ejercicio {
  id_ejercicio: number;
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

/**
 * Categoría transformada para uso en la aplicación
 */
export interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
}

/**
 * Ejercicio favorito transformado
 */
export interface EjercicioFavorito {
  id: number;
  id_usuario: UUID;
  id_ejercicio: number;
}
