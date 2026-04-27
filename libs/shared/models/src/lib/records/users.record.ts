/**
 * Forma del record de usuario expandido. Convex es la fuente de persistencia;
 * este tipo describe el contrato de datos que consumen las apps.
 */

import { UUID } from '../types/common';
import { Puesto } from '../domain/users';

interface DetalleUsuarioRecord {
  dni: string;
  telefono: string;
  direccion: string;
  postal: string;
}

interface ClinicaUsuarioRecord {
  clinicId: string;
  puesto: Puesto | null;
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
