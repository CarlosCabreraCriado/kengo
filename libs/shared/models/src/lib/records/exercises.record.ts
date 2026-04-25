/**
 * Forma del record de ejercicio expandido (snake_case, ids numéricos).
 * Convex es la fuente de persistencia; este tipo describe el contrato de
 * datos que consumen las apps.
 */

import { UUID } from '../types/common';

export interface EjercicioRecord {
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
