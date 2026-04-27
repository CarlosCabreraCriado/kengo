/**
 * Tipos de dominio para sesiones de ejercicio
 * Tipos relacionados con la ejecución de planes por pacientes
 */

import { EjercicioPlan, PlanCompleto, RegistroEjercicio } from './plans';

/**
 * Estado de la pantalla durante una sesión de ejercicios
 */
export type EstadoPantalla =
  | 'resumen'
  | 'ejercicio'
  | 'descanso'
  | 'feedback-final';

/**
 * Sesión local guardada (formato legacy v1).
 *
 * @deprecated Sustituido por `SesionHintUI` (clave `kengo:sesion_activa:v2`).
 * Las executions se persisten ya en Convex al instante; el cliente solo
 * conserva un hint efímero de UI. Eliminar este tipo cuando ningún archivo
 * lo importe (PR-Persist-3).
 */
export interface SesionLocal {
  planId: string;
  ejercicioIndex: number;
  serieActual: number;
  estado: EstadoPantalla;
  registrosPendientes: RegistroEjercicio[];
  timestamp: string;
}

/**
 * Hint efímero de UI para retomar la sesión exactamente donde el paciente
 * la dejó. La fuente de verdad de los datos clínicos es Convex
 * (`sessions` + `exerciseExecutions`); este hint solo evita que tras
 * recargar la pestaña el usuario tenga que volver a posicionarse.
 *
 * Persistido en `localStorage` con clave `kengo:sesion_activa:v2` y TTL 4 h.
 * Si caduca o no existe, el cliente reconstruye el estado desde Convex
 * (primer ejercicio sin execution completada).
 */
export interface SesionHintUI {
  sessionId: string;
  ejercicioIndex: number;
  serieActual: number;
  estadoPantalla: EstadoPantalla;
  timestamp: string;
}

/**
 * Feedback de un ejercicio completado
 */
export interface FeedbackEjercicio {
  dolor: number;
  esfuerzo?: number;
  nota?: string;
}

/**
 * Ejercicio de plan con estado de completado
 */
export interface EjercicioPlanConEstado extends EjercicioPlan {
  completadoHoy: boolean;
  registroId?: string;
  vecesCompletadasHoy?: number;
}

/**
 * Actividad de un plan para un día específico
 */
export interface ActividadPlanDia {
  plan: PlanCompleto;
  ejerciciosHoy: EjercicioPlanConEstado[];
  totalEjercicios: number;
  completados: number;
  progreso: number; // 0-100
}

/**
 * Información de un día próximo con ejercicios programados
 */
export interface DiaProximo {
  fecha: Date;
  fechaFormateada: string;
  diaSemana: string;
  totalEjercicios: number;
  planes: {
    planId: string;
    titulo: string;
    ejercicios: number;
  }[];
}

/**
 * Ejercicio con información del plan (para sesiones multi-plan)
 */
export interface EjercicioSesionMultiPlan extends EjercicioPlan {
  planId: string;
  planTitulo: string;
  planItemId: string;
}

/**
 * Configuración de sesión multi-plan
 */
export interface ConfigSesionMultiPlan {
  titulo: string;
  fecha: Date;
  esFechaProgramada: boolean;
  ejercicios: EjercicioSesionMultiPlan[];
  planesInvolucrados: {
    planId: string;
    titulo: string;
    cantidadEjercicios: number;
  }[];
  skipResumen?: boolean;
}

/**
 * Datos completos para generar PDF de plan
 */
export interface PlanPDFData {
  plan: import('./plans').PlanData;
  ejercicios: import('./plans').EjercicioPlanData[];
  clinica: import('./clinics').ClinicaData;
  paciente: import('./users').UserData;
  fisio: import('./users').UserData;
  magicLinkUrl: string;
}
