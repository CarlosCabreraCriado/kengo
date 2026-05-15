import { ChangeDetectionStrategy, Component, inject, signal, ViewChild } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  passwordMatchValidator,
  emailRequired,
  passwordRequired,
  passwordRepeatRequired,
} from '../../../../shared';
import {
  Ui2CreamBgComponent,
  Ui2CardComponent,
  Ui2BigTitleComponent,
  Ui2InputComponent,
  Ui2ButtonComponent,
  Ui2StepperComponent,
  Ui2StepComponent,
} from '../../../../shared/ui-v2';
import type { CreateUsuarioPayload, RegistroErrorCode } from '@kengo/shared-models';

@Component({
  standalone: true,
  selector: 'app-registro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    Ui2CreamBgComponent,
    Ui2CardComponent,
    Ui2BigTitleComponent,
    Ui2InputComponent,
    Ui2ButtonComponent,
    Ui2StepperComponent,
    Ui2StepComponent,
  ],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css',
})
export class RegistroComponent {
  @ViewChild('stepper') stepper!: Ui2StepperComponent;

  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  currentStep = signal(0);
  error = signal<string | null>(null);
  isLoading = signal(false);

  datosForm = this.fb.group({
    nombre: ['', Validators.required],
    apellidos: ['', Validators.required],
    email: ['', emailRequired],
  });

  // Permite pre-rellenar el código al llegar desde un email de invitación
  // tipo `/auth/registro?codigo=XXXXXXXX`. Normalizamos a uppercase para
  // alinear con el formato canónico que valida el backend.
  codigoClinicaForm = this.fb.group({
    codigo: [
      (this.route.snapshot.queryParamMap.get('codigo') ?? '')
        .trim()
        .toUpperCase(),
    ],
  });

  passwordForm = this.fb.group({
    password: ['', passwordRequired()],
    repetir: ['', passwordRepeatRequired],
  }, { validators: passwordMatchValidator() });

  nextStep(): void {
    if (this.stepper) {
      this.stepper.next();
      this.currentStep.set(this.stepper.selectedIndex);
    }
  }

  previousStep(): void {
    if (this.stepper) {
      this.stepper.previous();
      this.currentStep.set(this.stepper.selectedIndex);
    }
  }

  onStepChange(event: { selectedIndex: number }): void {
    this.currentStep.set(event.selectedIndex);
  }

  async completarRegistro(): Promise<void> {
    if (!this.passwordForm.valid || !this.passwordsMatch) {
      return;
    }

    this.error.set(null);
    this.isLoading.set(true);

    try {
      const payload: CreateUsuarioPayload = {
        first_name: this.datosForm.value.nombre!.trim(),
        last_name: this.datosForm.value.apellidos!.trim(),
        email: this.datosForm.value.email!.toLowerCase().trim(),
        password: this.passwordForm.value.password!,
        codigo_clinica: this.codigoClinicaForm.value.codigo?.trim() || undefined,
      };

      const result = await this.authService.register(payload);

      if (!result.success) {
        this.handleRegistroError(result.code);
        return;
      }

      await this.authService.login(payload.email, payload.password);
      this.router.navigate(['/inicio']);
    } catch (err: unknown) {
      const httpError = err as { error?: { code?: RegistroErrorCode } };
      if (httpError.error?.code) {
        this.handleRegistroError(httpError.error.code);
      } else {
        this.error.set('Error de conexión. Por favor, intenta de nuevo.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private handleRegistroError(code: RegistroErrorCode): void {
    switch (code) {
      case 'EMAIL_DUPLICADO':
        this.error.set('Este email ya está registrado. Intenta iniciar sesión o usa otro email.');
        break;
      case 'CLINICA_NO_ENCONTRADA':
        this.error.set('El código de clínica no es válido. Verifica el código o déjalo en blanco.');
        break;
      case 'VALIDATION_ERROR':
        this.error.set('Los datos ingresados no son válidos. Revisa el formulario.');
        break;
      case 'SERVER_ERROR':
      default:
        this.error.set('Error del servidor. Por favor, intenta más tarde.');
        break;
    }
  }

  get nombreError(): string | undefined {
    const ctrl = this.datosForm.get('nombre');
    if (!ctrl || !ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'El nombre es requerido';
    return undefined;
  }

  get apellidosError(): string | undefined {
    const ctrl = this.datosForm.get('apellidos');
    if (!ctrl || !ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'Los apellidos son requeridos';
    return undefined;
  }

  get emailError(): string | undefined {
    const ctrl = this.datosForm.get('email');
    if (!ctrl || !ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'El email es requerido';
    if (ctrl.hasError('email')) return 'El formato del email no es válido';
    return undefined;
  }

  get passwordError(): string | undefined {
    const ctrl = this.passwordForm.get('password');
    if (!ctrl || !ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'La contraseña es requerida';
    if (ctrl.hasError('minlength')) return 'Debe tener al menos 8 caracteres';
    return undefined;
  }

  get repetirError(): string | undefined {
    const ctrl = this.passwordForm.get('repetir');
    if (!ctrl || !ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'Repetir la contraseña es requerido';
    if (!this.passwordsMatch) return 'Las contraseñas no coinciden';
    return undefined;
  }

  get passwordsMatch(): boolean {
    return this.passwordForm.value.password === this.passwordForm.value.repetir;
  }
}
