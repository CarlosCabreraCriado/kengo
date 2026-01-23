export interface PlanData {
  id_plan: number;
  titulo: string;
  descripcion: string | null;
  estado: string;
  fecha_inicio: Date | null;
  fecha_fin: Date | null;
  paciente: string;
  fisio: string;
}

export interface EjercicioPlan {
  id: number;
  sort: number | null;
  series: number;
  repeticiones: number;
  duracion_seg: number | null;
  descanso_seg: number | null;
  veces_dia: number;
  dias_semana: string | null;
  instrucciones_paciente: string | null;
  notas_fisio: string | null;
  id_ejercicio: number;
  nombre_ejercicio: string;
  ejercicio_descripcion: string | null;
  portada: string | null;
}

export interface ClinicaData {
  id_clinica: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  postal: string | null;
  logo: string | null;
  color_primario: string | null;
  color_secundario: string | null;
}

export interface UserData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
}

export interface PlanPDFData {
  plan: PlanData;
  ejercicios: EjercicioPlan[];
  clinica: ClinicaData;
  paciente: UserData;
  fisio: UserData;
  magicLinkUrl: string;
}
