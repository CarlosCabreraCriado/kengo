/**
 * Tipos de dominio para cumplimiento diario
 * Tipos transformados para uso en las apps
 */

export type TipoCumplimiento = 'completado' | 'parcial' | 'fallido' | 'descanso';

export interface CumplimientoDia {
  fecha: string;
  tipo: TipoCumplimiento;
  ejerciciosEsperados: number;
  ejerciciosCompletados: number;
  dolorPromedio: number | null;
  planes: { planId: string; titulo: string; esperados: number; completados: number }[];
}

export interface ResumenCumplimiento {
  diasProgramados: number;
  diasCompletados: number;
  diasParciales: number;
  diasFallidos: number;
  diasDescanso: number;
  adherenciaReal: number;
}

export interface CumplimientoResponse {
  dias: CumplimientoDia[];
  resumen: ResumenCumplimiento;
}

/** Métricas resumen de un paciente (endpoint bulk) */
export interface MetricasPaciente {
  adherencia: number;
  dolorPromedio: number | null;
}

/** Respuesta del endpoint bulk: mapa paciente UUID → métricas */
export type MetricasPacientesBulk = Record<string, MetricasPaciente>;
