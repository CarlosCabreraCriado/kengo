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

/**
 * Categorías de notificación. Extensible para futuras fuentes.
 * - 'comentario_paciente': un paciente dejó un comentario/observación (tabla notificaciones_fisio)
 */
export type CategoriaNotificacion = 'comentario_paciente';

/**
 * Notificación genérica para mostrar en la campana de la app.
 * Diseñada para ser independiente de la tabla de origen.
 */
export interface NotificacionApp {
  id: number;
  fuente: string;
  categoria: CategoriaNotificacion;
  emisor_nombre: string;
  emisor_avatar: string | null;
  emisor_id: string;
  titulo: string;
  texto: string | null;
  fecha: string;
  leida: boolean;
  ruta_destino: string;
}

export interface NotificacionesAppResponse {
  notificaciones: NotificacionApp[];
  pendientes: number;
  total: number;
}
