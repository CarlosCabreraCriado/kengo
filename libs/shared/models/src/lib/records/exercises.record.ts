/**
 * Forma del record de ejercicio expandido. Convex es la fuente de persistencia;
 * este tipo describe el contrato de datos que consumen las apps.
 */

import { UUID } from '../types/common';

export interface EjercicioRecord {
  id: string;
  categoria: string[];
  nombre: string;
  descripcion: string;
  repeticionesDefecto?: number;
  seriesDefecto?: number;
  video: UUID | null;
  portada: UUID | null;
  videoUrl?: string;
  portadaUrl?: string;
}
