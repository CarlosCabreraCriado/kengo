/**
 * Tipos de base de datos para códigos de acceso
 * Reflejan exactamente la estructura de la tabla codigos_acceso
 */

import { UUID } from '../types/common';

/**
 * Tipo de código de acceso
 */
export type TipoCodigoAccesoDB = 'fisioterapeuta' | 'paciente';

/**
 * Tabla: codigos_acceso
 * Códigos para vincular usuarios a clínicas
 */
export interface CodigoAccesoDB {
  id: number;
  id_clinica: number;
  codigo: string;
  tipo: TipoCodigoAccesoDB;
  activo: boolean;
  usos_maximos: number | null;
  usos_actuales: number;
  fecha_expiracion: string | null;
  email: string | null;
  creado_por: UUID;
  date_created: string;
}
