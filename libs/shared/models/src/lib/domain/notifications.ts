/**
 * Tipos de dominio para notificaciones de fisioterapeutas
 */

export type TipoNotificacionFisio = 'comentario' | 'dolor_alto';

export interface NotificacionFisio {
  id: number;
  tipo: TipoNotificacionFisio;
  paciente: string;
  id_clinica: number;
  id_registro: number | null;
  id_sesion: number | null;
  fecha_registro: string;
  titulo_plan: string | null;
  nombre_ejercicio: string | null;
  texto: string | null;
  dolor_escala: number | null;
  revisada: boolean;
  fecha_revision: string | null;
  date_created: string | null;
}

export interface ComentariosPacienteResponse {
  comentarios: NotificacionFisio[];
  pendientes: number;
  total: number;
}
