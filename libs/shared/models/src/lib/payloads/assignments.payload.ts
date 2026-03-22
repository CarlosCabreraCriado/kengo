import type { UUID } from '../types/common';

/**
 * Payload para asignación masiva de fisios responsables.
 */
export interface BulkAsignacionPayload {
  id_clinica: number;
  asignaciones: { id_paciente: UUID; id_fisio: UUID | null }[];
}

/**
 * Respuesta del endpoint de asignación masiva.
 */
export interface BulkAsignacionResponse {
  success: boolean;
  asignadas: number;
  eliminadas: number;
}
