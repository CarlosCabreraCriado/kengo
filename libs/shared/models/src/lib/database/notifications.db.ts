/**
 * Tipos de base de datos para notificaciones de fisioterapeutas
 * Refleja la estructura de la tabla notificaciones_fisio
 */

import { UUID } from '../types/common';

/**
 * Tabla: notificaciones_fisio
 * Notificaciones generadas para fisios sobre comentarios/dolor de pacientes
 */
export interface NotificacionFisioDB {
  id: number;
  tipo: string;
  paciente: UUID;
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
