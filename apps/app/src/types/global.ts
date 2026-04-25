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
  RolUsuario,
} from '@kengo/shared-models';

// Tipos legacy de "shape de Directus" — siguen usándose como interfaces de
// datos (records expandidos del backend) aunque la fuente ahora es Convex.
// Pendiente futuro: renombrar a *Record y unificar con tipos de dominio.
export {
  UsuarioDirectus,
  EjercicioDirectus,
  EstadoPlan,
  RegistroEjercicioDirectus,
  VisibilidadRutina,
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
  ClinicaImagen,
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
  // Compliance
  TipoCumplimiento,
  CumplimientoDia,
  ResumenCumplimiento,
  CumplimientoResponse,
  MetricasPaciente,
  MetricasPacientesBulk,
  // Dashboard
  ResumenFisioDashboard,
  PlanPorVencer,
  // Notifications
  TipoNotificacionFisio,
  NotificacionFisio,
  ComentariosPacienteResponse,
  CategoriaNotificacion,
  NotificacionApp,
  NotificacionesAppResponse,
  // Assignments
  AsignacionResponsable,
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
  UpdateClinicaPayload,
  VincularClinicaPayload,
  VincularClinicaResponse,
  CrearClinicaResponse,
  GenerarCodigoPayload,
  GenerarCodigoResponse,
  // Email verification payloads
  EnviarVerificacionPayload,
  VerificarEmailPayload,
  VerificacionEmailErrorCode,
  EnviarVerificacionResult,
  VerificarEmailResult,
  // Assignment payloads
  BulkAsignacionPayload,
  BulkAsignacionResponse,
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
