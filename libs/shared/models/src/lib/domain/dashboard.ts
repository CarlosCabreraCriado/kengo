export interface ResumenFisioDashboard {
  pacientes_activos: number;
  adherencia_promedio: number;
  planes_por_vencer: PlanPorVencer[];
}

export interface PlanPorVencer {
  id_plan: number | string;
  titulo: string;
  fecha_fin: string;
  paciente_nombre: string;
  paciente_id: string;
}
