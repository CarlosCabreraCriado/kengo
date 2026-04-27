export interface ResumenFisioDashboard {
  pacientesActivos: number;
  adherenciaPromedio: number;
  planesPorVencer: PlanPorVencer[];
}

export interface PlanPorVencer {
  id: string;
  titulo: string;
  fechaFin: string;
  pacienteNombre: string;
  pacienteId: string;
}
