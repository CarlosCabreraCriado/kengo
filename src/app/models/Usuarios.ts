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
