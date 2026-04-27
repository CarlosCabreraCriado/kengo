/**
 * Forma del record de plan / registro expandido. Convex es la fuente de
 * persistencia; este tipo describe el contrato de datos que consumen las apps.
 */

import { UsuarioRecord } from './users.record';

/**
 * Estado del plan (incluye 'cancelado' para compatibilidad con frontend)
 * Nota: 'cancelado' existe en frontend pero NO está definido en BD
 */
export type EstadoPlan = 'borrador' | 'activo' | 'completado' | 'cancelado';

export interface RegistroEjercicioRecord {
  id: string;
  planItemId: string | { id: string };
  pacienteId: string | UsuarioRecord;
  fechaHora: string;
  completado: boolean;
  repeticionesRealizadas?: number;
  duracionRealSeg?: number;
  dolorEscala?: number;
  esfuerzoEscala?: number;
  notaPaciente?: string;
}
