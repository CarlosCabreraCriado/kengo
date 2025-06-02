export interface Usuario {
  id: string;
  avatar: string;
  first_name: string;
  last_name: string;
  email: string;
  detalle: DetalleUsuario | null;
}

export interface DetalleUsuario {
  dni: string;
  telefono: string;
  direccion: string;
  postal: string;
}

export interface Accesos {
  isPaciente: boolean;
  isFisio: boolean;
}

export type SeccionPrincipal =
  | 'inicio'
  | 'ejercicios'
  | 'pacientes'
  | 'clinica';
