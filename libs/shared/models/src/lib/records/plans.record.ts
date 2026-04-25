/**
 * Forma del record de plan / registro expandido (snake_case, ids numéricos).
 * Convex es la fuente de persistencia; este tipo describe el contrato de
 * datos que consumen las apps.
 */

import { UsuarioRecord } from './users.record';

/**
 * Estado del plan (incluye 'cancelado' para compatibilidad con frontend)
 * Nota: 'cancelado' existe en frontend pero NO está definido en BD
 */
export type EstadoPlan = 'borrador' | 'activo' | 'completado' | 'cancelado';

export interface RegistroEjercicioRecord {
  id_registro: number;
  plan_item: number | { id: number };
  paciente: string | UsuarioRecord;
  fecha_hora: string;
  completado: boolean;
  repeticiones_realizadas?: number;
  duracion_real_seg?: number;
  dolor_escala?: number;
  esfuerzo_escala?: number;
  nota_paciente?: string;
}
