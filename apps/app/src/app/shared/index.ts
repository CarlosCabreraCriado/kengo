// Utils
export { KENGO_BREAKPOINTS, type BreakpointKey } from './utils/breakpoints';

// Validators
export { passwordMatchValidator } from './validators/password-match.validator';

// Pipes
export { SafeHtmlPipe } from './pipes/safe-html.pipe';

// UI Components - Existing
export { ImageUploadComponent } from './ui/image-upload/image-upload.component';
export { QrDialogComponent } from './ui/dialogo-qr/dialogo-qr.component';
export { DialogoPdfComponent, type DialogoPdfData } from './ui/dialogo-pdf/dialogo-pdf.component';
export { BotonTarjetaComponent } from './ui/boton-tarjeta/boton-tarjeta.component';
export { SelectorPacienteComponent } from './ui/selector-paciente/selector-paciente.component';

// UI Components - New (Material replacements)
export { ButtonComponent, type ButtonVariant, type ButtonSize } from './ui/button/button.component';
export { InputComponent, type InputType } from './ui/input/input.component';
export { SelectComponent, type SelectOption } from './ui/select/select.component';
export { TextareaComponent } from './ui/textarea/textarea.component';
export { CheckboxComponent } from './ui/checkbox/checkbox.component';
export { RadioGroupComponent, type RadioOption } from './ui/radio/radio-group.component';
export { ProgressBarComponent, type ProgressBarMode, type ProgressBarColor } from './ui/progress-bar/progress-bar.component';
export { SpinnerComponent, type SpinnerSize, type SpinnerColor } from './ui/spinner/spinner.component';
export { ChipComponent, type ChipVariant, type ChipSize } from './ui/chip/chip.component';
export { MenuComponent, type MenuItem } from './ui/menu/menu.component';
export { DividerComponent } from './ui/divider/divider.component';
export { TooltipDirective, type TooltipPosition } from './ui/tooltip/tooltip.directive';
export { DrawerComponent, type DrawerPosition } from './ui/drawer/drawer.component';
export { DatepickerComponent } from './ui/datepicker/datepicker.component';
export { StepperComponent, StepComponent } from './ui/stepper/stepper.component';

// Dialog
export {
  DialogService,
  type DialogOptions,
  type ConfirmDialogData,
  DialogContainerComponent,
  DialogHeaderComponent,
  DialogContentComponent,
  DialogActionsComponent,
  ConfirmDialogComponent,
} from './ui/dialog';

// Toast
export {
  ToastService,
  type Toast,
  type ToastType,
  type ToastOptions,
  ToastContainerComponent,
} from './ui/toast';
