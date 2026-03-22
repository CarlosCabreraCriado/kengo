import type { UUID } from '../types/common';

/**
 * Asignación de fisio responsable a un paciente dentro de una clínica.
 * Tipo de dominio transformado para uso en las apps.
 */
export interface AsignacionResponsable {
  id: number;
  idPaciente: UUID;
  idFisio: UUID;
  idClinica: number;
  nombreFisio?: string;
  apellidoFisio?: string;
  avatarFisio?: string;
  fechaCreacion: string;
}
