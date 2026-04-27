/**
 * Tipos de dominio para notificaciones de fisioterapeutas
 */

export type TipoNotificacionFisio = 'comentario' | 'dolor_alto';

export interface NotificacionFisio {
  id: string;
  tipo: TipoNotificacionFisio;
  pacienteId: string;
  clinicId: string;
  registroId: string | null;
  sesionId: string | null;
  fechaRegistro: string;
  tituloPlan: string | null;
  nombre: string | null;
  texto: string | null;
  dolorEscala: number | null;
  revisada: boolean;
  fechaRevision: string | null;
  dateCreated: string | null;
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
  id: string;
  fuente: string;
  categoria: CategoriaNotificacion;
  emisorNombre: string;
  emisorAvatar: string | null;
  emisorId: string;
  titulo: string;
  texto: string | null;
  fecha: string;
  leida: boolean;
  rutaDestino: string;
}

export interface NotificacionesAppResponse {
  notificaciones: NotificacionApp[];
  pendientes: number;
  total: number;
}
