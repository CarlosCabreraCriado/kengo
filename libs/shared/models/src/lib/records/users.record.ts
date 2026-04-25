/**
 * Forma del record de usuario expandido (snake_case, ids numéricos, objetos
 * anidados). Convex es la fuente de persistencia; este tipo describe el
 * contrato de datos que consumen las apps.
 */

import { UUID } from '../types/common';

interface DetalleUsuarioRecord {
  dni: string;
  telefono: string;
  direccion: string;
  postal: string;
}

interface ClinicaUsuarioRecord {
  id_clinica: number;
  id_puesto: number | null;
  puesto?: {
    id: number;
    puesto: string;
  };
}

export interface UsuarioRecord {
  id: UUID;
  avatar: string;
  first_name: string;
  last_name: string;
  email: string;
  email_verified?: boolean;
  detalle: DetalleUsuarioRecord | null;
  avatar_url?: string;
  telefono?: string;
  direccion?: string;
  magic_link_url?: string;
  clinicas: ClinicaUsuarioRecord[];
  postal?: string;
  numero_colegiado?: string;
}
