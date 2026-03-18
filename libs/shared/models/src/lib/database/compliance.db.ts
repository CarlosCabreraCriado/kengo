/**
 * Tipos de base de datos para cumplimiento diario
 * Refleja la estructura de la tabla cumplimiento_diario
 */

import { UUID } from '../types/common';

/**
 * Tabla: cumplimiento_diario
 * Registro diario de cumplimiento por paciente y plan
 */
export interface CumplimientoDiarioDB {
  id: number;
  fecha: string;
  paciente: UUID;
  plan: number;
  ejercicios_esperados: number;
  ejercicios_completados: number;
  es_dia_descanso: boolean;
  dolor_promedio: number | null;
  date_created: string | null;
}
