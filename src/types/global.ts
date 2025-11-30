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
  magic_link_url?: string;
  clinicas: {
    id_clinica: number;
    puestos: { id_puesto: number; puesto: string }[];
  }[];
  postal?: string;
  esFisio: boolean;
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
  magic_link_url?: string;
  clinicas: {
    id_clinica: number;
    puestos: { Puestos_id: { puesto: string; id: number } }[];
  }[];
  postal?: string;
  is_fisio: boolean;
  is_cliente: boolean;
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

export interface EjercicioPlan {
  id?: number;
  sort: number;
  date_created?: string;
  data_updated?: string;
  plan?: number;
  ejercicio: Ejercicio;
  instrucciones_paciente?: string;
  notas_fisio?: string;
  series?: number;
  repeticiones?: number;
  duracion_seg?: number;
  descanso_seg?: number;
  veces_dia?: number;
  dias_semana?: string[];
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

// ============================================
// PLANES
// ============================================

export type EstadoPlan = 'borrador' | 'activo' | 'completado' | 'cancelado';

export interface Plan {
  id_plan: number;
  paciente: string | Usuario;
  fisio: string | Usuario;
  titulo: string;
  descripcion?: string;
  estado: EstadoPlan;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  date_created?: string;
  date_updated?: string;
}

export interface PlanCompleto extends Plan {
  paciente: Usuario;
  fisio: Usuario;
  items: EjercicioPlan[];
}

export interface PlanDirectus {
  id_plan: number;
  paciente: string | UsuarioDirectus;
  fisio: string | UsuarioDirectus;
  titulo: string;
  descripcion?: string;
  estado: EstadoPlan;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  date_created?: string;
  date_updated?: string;
  ejercicios?: EjercicioPlanDirectus[];
}

export interface EjercicioPlanDirectus {
  id: number;
  sort: number;
  date_created?: string;
  date_updated?: string;
  plan: number;
  ejercicio: number | Ejercicio;
  instrucciones_paciente?: string;
  notas_fisio?: string;
  series?: number;
  repeticiones?: number;
  duracion_seg?: number;
  descanso_seg?: number;
  veces_dia?: number;
  dias_semana?: string[];
}

// ============================================
// RUTINAS (Plantillas)
// ============================================

export type VisibilidadRutina = 'privado' | 'publico';

export interface Rutina {
  id_rutina: number;
  nombre: string;
  descripcion?: string;
  autor: string | Usuario;
  visibilidad: VisibilidadRutina;
  date_created?: string;
  date_updated?: string;
}

export interface RutinaCompleta extends Rutina {
  autor: Usuario;
  ejercicios: EjercicioRutina[];
}

export interface RutinaDirectus {
  id_rutina: number;
  nombre: string;
  descripcion?: string;
  autor: string | UsuarioDirectus;
  visibilidad: VisibilidadRutina;
  date_created?: string;
  date_updated?: string;
  ejercicios?: EjercicioRutinaDirectus[];
}

export interface EjercicioRutina {
  id: number;
  sort: number;
  rutina: number;
  ejercicio: Ejercicio;
  series?: number;
  repeticiones?: number;
  duracion_seg?: number;
  descanso_seg?: number;
  veces_dia?: number;
  dias_semana?: string[];
  instrucciones_paciente?: string;
  notas_fisio?: string;
  date_created?: string;
  date_updated?: string;
}

export interface EjercicioRutinaDirectus {
  id: number;
  sort: number;
  rutina: number;
  ejercicio: number | Ejercicio;
  series?: number;
  repeticiones?: number;
  duracion_seg?: number;
  descanso_seg?: number;
  veces_dia?: number;
  dias_semana?: string[];
  instrucciones_paciente?: string;
  notas_fisio?: string;
  date_created?: string;
  date_updated?: string;
}

// ============================================
// Payloads para crear/actualizar
// ============================================

export interface CreatePlanPayload {
  paciente: string;
  fisio: string;
  titulo: string;
  descripcion?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  estado?: EstadoPlan;
  items: CreatePlanEjercicioPayload[];
}

export interface CreatePlanEjercicioPayload {
  ejercicio: number;
  sort: number;
  series?: number;
  repeticiones?: number;
  duracion_seg?: number;
  descanso_seg?: number;
  veces_dia?: number;
  dias_semana?: string[];
  instrucciones_paciente?: string;
  notas_fisio?: string;
}

export interface CreateRutinaPayload {
  nombre: string;
  descripcion?: string;
  autor: string;
  visibilidad: VisibilidadRutina;
  ejercicios: CreateRutinaEjercicioPayload[];
}

export interface CreateRutinaEjercicioPayload {
  ejercicio: number;
  sort: number;
  series?: number;
  repeticiones?: number;
  duracion_seg?: number;
  descanso_seg?: number;
  veces_dia?: number;
  dias_semana?: string[];
  instrucciones_paciente?: string;
  notas_fisio?: string;
}

// ============================================
// REGISTRO DE SESIONES (Realización de planes)
// ============================================

export type EstadoPantalla =
  | 'resumen'
  | 'ejercicio'
  | 'descanso'
  | 'feedback'
  | 'completado';

export interface RegistroEjercicio {
  id_registro?: number;
  plan_item: number;
  paciente: string;
  fecha_hora: string;
  completado: boolean;
  repeticiones_realizadas?: number;
  duracion_real_seg?: number;
  dolor_escala?: number;
  nota_paciente?: string;
}

export interface RegistroEjercicioDirectus {
  id_registro: number;
  plan_item: number | { id: number };
  paciente: string | UsuarioDirectus;
  fecha_hora: string;
  completado: boolean;
  repeticiones_realizadas?: number;
  duracion_real_seg?: number;
  dolor_escala?: number;
  nota_paciente?: string;
}

export interface SesionLocal {
  planId: number;
  ejercicioIndex: number;
  serieActual: number;
  estado: EstadoPantalla;
  registrosPendientes: RegistroEjercicio[];
  timestamp: string;
}

export interface FeedbackEjercicio {
  dolor: number;
  nota?: string;
}

// ============================================
// ACTIVIDAD DIARIA
// ============================================

export interface ActividadPlanDia {
  plan: PlanCompleto;
  ejerciciosHoy: EjercicioPlanConEstado[];
  totalEjercicios: number;
  completados: number;
  progreso: number; // 0-100
}

export interface EjercicioPlanConEstado extends EjercicioPlan {
  completadoHoy: boolean;
  registroId?: number;
  vecesCompletadasHoy?: number;
}

export interface DiaProximo {
  fecha: Date;
  fechaFormateada: string;
  diaSemana: string;
  totalEjercicios: number;
  planes: { planId: number; titulo: string; ejercicios: number }[];
}

// Ejercicio con info del plan original (para sesiones multi-plan)
export interface EjercicioSesionMultiPlan extends EjercicioPlan {
  planId: number;
  planTitulo: string;
  planItemId: number; // ID para registro en backend
}

// Configuracion de sesion multi-plan
export interface ConfigSesionMultiPlan {
  titulo: string;
  fecha: Date;
  esFechaProgramada: boolean;
  ejercicios: EjercicioSesionMultiPlan[];
  planesInvolucrados: {
    planId: number;
    titulo: string;
    cantidadEjercicios: number;
  }[];
}
