/**
 * Tipos de base de datos para ejercicios
 * Reflejan exactamente la estructura de las tablas ejercicios, categorias, etc.
 */

import { UUID } from '../types/common';

/**
 * Tabla: ejercicios
 * Catálogo de ejercicios disponibles
 */
export interface EjercicioDB {
  id_ejercicio: number;
  nombre_ejercicio: string | null;
  series_defecto: string | null;
  repeticiones_defecto: string | null;
  video: UUID | null;
  portada: UUID | null;
  descripcion: string | null;
}

/**
 * Tabla: categorias
 * Categorías para clasificar ejercicios
 */
export interface CategoriaDB {
  id_categoria: number;
  nombre_categoria: string | null;
}

/**
 * Tabla: ejercicios_categorias
 * Relación muchos a muchos entre ejercicios y categorías
 */
export interface EjercicioCategoriasDB {
  id: number;
  ejercicios_id_ejercicio: number | null;
  categorias_id_categoria: number | null;
}

/**
 * Tabla: ejercicios_favoritos
 * Ejercicios marcados como favoritos por usuarios
 */
export interface EjercicioFavoritoDB {
  id: number;
  id_usuario: UUID | null;
  id_ejercicio: number | null;
}
