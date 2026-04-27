import {
  RegistroEjercicioRecord,
  TipoCumplimiento,
} from '../../../../types/global';

export interface ComentarioSesion {
  texto: string;
  idRegistro: string;
}

/**
 * Sesión agrupada por fecha que combina cumplimiento (rollups) +
 * registros (executions) + notificaciones de comentario del fisio.
 *
 * `tieneObservacionSesion` es un campo derivado que la pieza visual de
 * actividad necesita sin tener que conocer la lista global de
 * notificaciones — el contenedor lo inyecta vía un computed que combina
 * sesiones + comentarios.
 */
export interface SesionAgrupada {
  fecha: string;
  fechaFormateada: string;
  registros: RegistroEjercicioRecord[];
  totalEjercicios: number;
  promedioDolorValue: number | null;
  comentarios: ComentarioSesion[];
  totalComentarios: number;
  tipo: TipoCumplimiento;
  ejerciciosEsperados: number;
  planes: {
    planId: string;
    titulo: string;
    esperados: number;
    completados: number;
  }[];
  /** True si la sesión tiene comentarios en sus registros o una
   *  notificación tipo "comentario" del fisio asociada por fecha. */
  tieneObservacionSesion: boolean;
}

export interface EstadisticasPaciente {
  totalSesiones: number;
  adherenciaGeneral: number;
  promedioDolorGeneral: number | null;
  diasDesdeUltimaSesion: number | null;
  rachaActual: number;
  adherenciaSemanal: { semana: string; porcentaje: number }[];
}

export type RangoFiltro = '15' | '30' | '60' | '90' | 'todo' | 'custom';
