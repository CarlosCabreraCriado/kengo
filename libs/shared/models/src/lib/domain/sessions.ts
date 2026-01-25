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
 * Sesión local guardada (para recuperación)
 */
export interface SesionLocal {
  planId: number;
  ejercicioIndex: number;
  serieActual: number;
  estado: EstadoPantalla;
  registrosPendientes: RegistroEjercicio[];
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
  registroId?: number;
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
    planId: number;
    titulo: string;
    ejercicios: number;
  }[];
}

/**
 * Ejercicio con información del plan (para sesiones multi-plan)
 */
export interface EjercicioSesionMultiPlan extends EjercicioPlan {
  planId: number;
  planTitulo: string;
  planItemId: number;
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
    planId: number;
    titulo: string;
    cantidadEjercicios: number;
  }[];
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
