/**
 * Forma del record de plan / registro expandido. Convex es la fuente de
 * persistencia; este tipo describe el contrato de datos que consumen las apps.
 */

import { UsuarioRecord } from './users.record';

/** Estado del plan. Debe mantenerse alineado con el enum del schema en `convex/schema.ts`. */
export type EstadoPlan =
  | 'borrador'
  | 'activo'
  | 'completado'
  | 'modificado'
  | 'cancelado';

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
