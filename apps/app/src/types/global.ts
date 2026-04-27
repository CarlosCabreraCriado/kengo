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

// Tipos *Record que describen la forma del record expandido del backend
// (snake_case, ids numéricos, objetos anidados). Convex es la fuente de
// persistencia; estos tipos son el contrato de datos en frontend.
export {
  UsuarioRecord,
  EjercicioRecord,
  EstadoPlan,
  RegistroEjercicioRecord,
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
  SesionHintUI,
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
