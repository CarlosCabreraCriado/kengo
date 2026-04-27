/**
 * Tipos de dominio para cumplimiento diario
 * Tipos transformados para uso en las apps
 */

export type TipoCumplimiento = 'completado' | 'parcial' | 'fallido' | 'descanso';

export interface CumplimientoDia {
  fecha: string;
  tipo: TipoCumplimiento;
  ejercicios_esperados: number;
  ejercicios_completados: number;
  dolor_promedio: number | null;
  planes: { plan_id: string; titulo: string; esperados: number; completados: number }[];
}

export interface ResumenCumplimiento {
  dias_programados: number;
  dias_completados: number;
  dias_parciales: number;
  dias_fallidos: number;
  dias_descanso: number;
  adherencia_real: number;
}

export interface CumplimientoResponse {
  dias: CumplimientoDia[];
  resumen: ResumenCumplimiento;
}

/** Métricas resumen de un paciente (endpoint bulk) */
export interface MetricasPaciente {
  adherencia: number;
  dolor_promedio: number | null;
}

/** Respuesta del endpoint bulk: mapa paciente UUID → métricas */
export type MetricasPacientesBulk = Record<string, MetricasPaciente>;
