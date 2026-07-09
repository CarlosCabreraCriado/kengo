/**
 * Forma del record de ejercicio expandido. Convex es la fuente de persistencia;
 * este tipo describe el contrato de datos que consumen las apps.
 */

import { UUID } from '../types/common';
import { TipoEjercicio } from '../domain/exercises';

export interface EjercicioRecord {
  id: string;
  categoria: string[];
  nombre: string;
  descripcion: string;
  tipo?: TipoEjercicio;
  repeticionesDefecto?: number;
  seriesDefecto?: number;
  duracionDefectoSeg?: number;
  video: UUID | null;
  portada: UUID | null;
  videoUrl?: string;
  portadaUrl?: string;
}
