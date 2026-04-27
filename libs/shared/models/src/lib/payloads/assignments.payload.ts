import type { UUID } from '../types/common';

/**
 * Payload para asignación masiva de fisios responsables.
 */
export interface BulkAsignacionPayload {
  clinicId: string;
  asignaciones: { pacienteId: UUID; fisioId: UUID | null }[];
}

/**
 * Respuesta del endpoint de asignación masiva.
 */
export interface BulkAsignacionResponse {
  success: boolean;
  asignadas: number;
  eliminadas: number;
}
