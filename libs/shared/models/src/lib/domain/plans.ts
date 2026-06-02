/**
 * Tipos de dominio para planes de tratamiento
 * Tipos transformados y listos para usar en las aplicaciones
 */

import { DiaSemana, UUID } from '../types/common';
import { Usuario } from './users';
import { Ejercicio } from './exercises';

// Re-export de EstadoPlan desde records/plans.record
export { EstadoPlan } from '../records/plans.record';

/**
 * Plan transformado para uso en la aplicación
 */
export interface Plan {
  id: string;
  paciente: UUID | Usuario;
  fisio: UUID | Usuario;
  titulo: string;
  descripcion?: string;
  estado: 'borrador' | 'activo' | 'completado' | 'modificado' | 'cancelado';
  fechaInicio?: string | null;
  fechaFin?: string | null;
  dateCreated?: string;
  dateUpdated?: string;
  planAnterior?: string | null;
  planSucesor?: string | null;
  version?: number;
}

/**
 * Plan con todos los datos expandidos
 */
export interface PlanCompleto extends Plan {
  paciente: Usuario;
  fisio: Usuario;
  items: EjercicioPlan[];
}

/**
 * Ejercicio dentro de un plan
 */
export interface EjercicioPlan {
  id?: string;
  sort: number;
  dateCreated?: string;
  dateUpdated?: string;
  planId?: string;
  /**
   * Id estable del item dentro del plan, usado por `@for ... track` en plantillas
   * de sesión. En multi-plan equivale al `planExercise._id`; en single-plan se
   * deriva del `id` del item al construir `SesionStateService.ejerciciosList`.
   * `EjercicioSesionMultiPlan` lo redefine como requerido.
   */
  planItemId?: string;
  ejercicio: Ejercicio;
  instruccionesPaciente?: string;
  notasFisio?: string;
  series?: number;
  repeticiones?: number;
  duracionSeg?: number;
  descansoSeg?: number;
  diasSemana?: DiaSemana[];
}

export interface RegistroEjercicio {
  id?: string;
  /** Convex `Id<"exerciseExecutions">`. Presente cuando la execution ya
   *  está creada en Convex (flujo nuevo: insertada al completar el
   *  ejercicio, no al final de la sesión). Permite aplicar el feedback
   *  vía `executions.mutations.applyFeedbackBatch`. */
  executionId?: string;
  planItemId: string;
  pacienteId: UUID;
  fechaHora: string;
  completado: boolean;
  repeticionesRealizadas?: number;
  duracionRealSeg?: number;
  dolorEscala?: number;
  esfuerzoEscala?: number;
  notaPaciente?: string;
}

export interface PlanData {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  paciente: UUID;
  fisio: UUID;
}

export interface EjercicioPlanData {
  id: string;
  sort: number | null;
  series: number;
  repeticiones: number;
  duracionSeg: number | null;
  descansoSeg: number | null;
  diasSemana: string | null;
  instruccionesPaciente: string | null;
  notasFisio: string | null;
  ejercicioId: string;
  nombreEjercicio: string;
  ejercicioDescripcion: string | null;
  portada: string | null;
}
