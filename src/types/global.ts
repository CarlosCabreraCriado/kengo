//Tipos de correos:
export type ID = string | number;
export type RolUsuario = 'fisio' | 'paciente';
export type SeccionPrincipal =
  | 'inicio'
  | 'ejercicios'
  | 'pacientes'
  | 'clínica';

export interface Usuario {
  id: string;
  avatar: string;
  first_name: string;
  last_name: string;
  email: string;
  detalle: DetalleUsuario | null;
  telefono?: string;
  direccion?: string;
  avatar_url?: string;
  clinicas: {
    id_clinica: number;
    puestos: { id_puesto: number; puesto: string }[];
  }[];
  esCliente: boolean;
  esPaciente: boolean;
}

export interface UsuarioDirectus {
  id: string;
  avatar: string;
  first_name: string;
  last_name: string;
  email: string;
  detalle: DetalleUsuario | null;
  avatar_url?: string;
  telefono?: string;
  direccion?: string;
  clinicas: {
    id_clinica: number;
    puestos: { Puestos_id: { puesto: string; id: number } }[];
  }[];
  is_cliente: boolean;
  is_paciente: boolean;
}

export interface DetalleUsuario {
  dni: string;
  telefono: string;
  direccion: string;
  postal: string;
}

export interface Ejercicio {
  id_ejercicio: number;
  categoria: string[];
  nombre_ejercicio: string;
  descripcion: string;
  repeticiones_defecto: string;
  series_defecto: string;
  video: string;
  portada: string;
  video_url?: string;
  portada_url?: string;
}

export interface ClinicaDirectus {
  id_clinica: ID;
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  postal?: string | null;
  nif?: string | null;
  color_primario?: string | null; // ajusta si tu campo se llama distinto
  logo?: { id: ID } | null;
  imagenes?: { directus_files_id: ID }[] | null; // campo tipo Files (múltiple)
}

export interface Clinica {
  id_clinica: number;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  postal?: string | null;
  nif?: string | null;
  color_primario?: string | null; // ajusta si tu campo se llama distinto
  color_secundario?: string | null; // ajusta si tu campo se llama distinto
  logo?: string | null;
  imagenes?: string[] | null; // campo tipo Files (múltiple)
}

export interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
}

export interface Accesos {
  isPaciente: boolean;
  isFisio: boolean;
}
