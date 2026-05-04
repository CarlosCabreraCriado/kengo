// Utils
export { KENGO_BREAKPOINTS, type BreakpointKey } from './utils/breakpoints';

// Composables
export { useResponsive, type ResponsiveSignals } from './composables/use-responsive';

// Validators
export { passwordMatchValidator } from './validators/password-match.validator';
export {
  emailRequired,
  emailOptional,
  passwordRequired,
  passwordRepeatRequired,
  otpCode,
  clinicaCode,
  postalCode,
} from './validators/common-validators';

// Pipes
export { SafeHtmlPipe } from './pipes/safe-html.pipe';

// Servicios compartidos (neutrales — usables desde catálogos ui-* y ui2-*)
export {
  ToastService,
  type Toast,
  type ToastType,
  type ToastOptions,
} from './services/toast';
export {
  DialogService,
  type DialogOptions,
  type ConfirmDialogData,
} from './services/dialog';

// Componentes legacy especializados (sin equivalente V2 — uso permitido en pantallas V2)
export { ImageUploadComponent } from './ui/image-upload/image-upload.component';
export { DialogoPdfComponent, type DialogoPdfData } from './ui/dialogo-pdf/dialogo-pdf.component';
export { SelectorPacienteComponent } from './ui/selector-paciente/selector-paciente.component';
export { VideoEjercicioComponent } from './ui/video-ejercicio/video-ejercicio.component';
export { PreviewEjercicioDialogComponent, type PreviewEjercicioData } from './ui/preview-ejercicio/preview-ejercicio-dialog.component';
export { ConfirmDialogComponent } from './ui/dialog';
