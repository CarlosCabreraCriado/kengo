/**
 * Tipos globales para la aplicación Angular de Kengo
 *
 * Re-exporta los tipos compartidos desde @kengo/shared-models
 * y define tipos específicos del frontend.
 */

// ============================================
// RE-EXPORTAR TIPOS COMPARTIDOS
// ============================================

// Tipos base y utilitarios
export {
  ID,
  UUID,
  Timestamp,
  DiaSemana,
  DirectusAuditFields,
  RolUsuario,
} from '@kengo/shared-models';

// Tipos de base de datos (para referencia)
export type {
  DirectusUserDB,
  DetalleUsuarioDB,
  PuestoDB,
  EjercicioDB,
  CategoriaDB,
  EjercicioCategoriasDB,
  EjercicioFavoritoDB,
  EstadoPlanDB,
  PlanDB,
  PlanEjercicioDB,
  PlanRegistroDB,
  VisibilidadRutinaDB,
  RutinaDB,
  RutinaEjercicioDB,
  ClinicaDB,
  UsuarioClinicaDB,
  ClinicaFilesDB,
} from '@kengo/shared-models';

// Tipos Directus
export {
  UsuarioDirectus,
  DetalleUsuarioDirectus,
  ClinicaUsuarioDirectus,
  EjercicioDirectus,
  CategoriaDirectus,
  EjercicioFavoritoDirectus,
  EstadoPlan,
  PlanDirectus,
  EjercicioPlanDirectus,
  RegistroEjercicioDirectus,
  VisibilidadRutina,
  RutinaDirectus,
  EjercicioRutinaDirectus,
  ClinicaDirectus,
} from '@kengo/shared-models';

// Tipos de dominio
export {
  Usuario,
  DetalleUsuario,
  Puesto,
  ClinicaUsuario,
  UserData,
  Accesos,
  Ejercicio,
  Categoria,
  EjercicioFavorito,
  Plan,
  PlanCompleto,
  EjercicioPlan,
  RegistroEjercicio,
  PlanData,
  EjercicioPlanData,
  Rutina,
  RutinaCompleta,
  EjercicioRutina,
  Clinica,
  ClinicaData,
  EstadoPantalla,
  SesionLocal,
  FeedbackEjercicio,
  EjercicioPlanConEstado,
  ActividadPlanDia,
  DiaProximo,
  EjercicioSesionMultiPlan,
  ConfigSesionMultiPlan,
  PlanPDFData,
  // Access codes
  CodigoAcceso,
  TipoCodigoAcceso,
  ValidacionCodigo,
  PUESTO_FISIOTERAPEUTA,
  PUESTO_PACIENTE,
  PUESTO_ADMINISTRADOR,
} from '@kengo/shared-models';

// Payloads
export {
  CreatePlanPayload,
  CreatePlanEjercicioPayload,
  UpdatePlanPayload,
  UpdatePlanEjercicioPayload,
  CreateRegistroEjercicioPayload,
  CreateRutinaPayload,
  CreateRutinaEjercicioPayload,
  UpdateRutinaPayload,
  UpdateRutinaEjercicioPayload,
  // Clinic payloads
  CreateClinicaPayload,
  VincularClinicaPayload,
  VincularClinicaResponse,
  CrearClinicaResponse,
  GenerarCodigoPayload,
  GenerarCodigoResponse,
} from '@kengo/shared-models';

// ============================================
// TIPOS ESPECÍFICOS DEL FRONTEND
// ============================================

/**
 * Secciones principales de navegación en la app
 */
export type SeccionPrincipal =
  | 'inicio'
  | 'ejercicios'
  | 'pacientes'
  | 'clínica';
