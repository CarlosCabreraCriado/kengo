import type { UUID } from '../types/common';

/**
 * Tabla `asignaciones_responsable`
 * Refleja exactamente la estructura de la BD.
 * Relación 1:1 paciente-clínica → fisio responsable.
 */
export interface AsignacionResponsableDB {
  id: number;
  id_paciente: UUID | null;
  id_fisio: UUID | null;
  id_clinica: number | null;
  user_created: UUID | null;
  date_created: string | null;
  user_updated: UUID | null;
  date_updated: string | null;
}
