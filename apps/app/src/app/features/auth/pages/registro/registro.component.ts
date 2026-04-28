import { Component, inject, signal, ViewChild } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  StepperComponent,
  StepComponent,
  passwordMatchValidator,
  emailRequired,
  passwordRequired,
  passwordRepeatRequired,
  InputComponent,
  ButtonComponent,
  RadioGroupComponent,
  type RadioOption,
} from '../../../../shared';
import type { CreateUsuarioPayload, RegistroErrorCode } from '@kengo/shared-models';

@Component({
  standalone: true,
  selector: 'app-registro',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    StepperComponent,
    StepComponent,
    InputComponent,
    ButtonComponent,
    RadioGroupComponent,
  ],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css',
})
export class RegistroComponent {
  @ViewChild('stepper') stepper!: StepperComponent;

  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  currentStep = signal(0);
  error = signal<string | null>(null);
  isLoading = signal(false);

  readonly tipoUsuarioOptions: RadioOption[] = [
    {
      value: 'fisioterapeuta',
      label: 'Fisioterapeuta',
      description: 'Gestiona pacientes y planes de tratamiento',
    },
    {
      value: 'paciente',
      label: 'Paciente',
      description: 'Realiza ejercicios y sigue tu progreso',
    },
  ];

  // Formularios:
  datosForm = this.fb.group({
    nombre: ['', Validators.required],
    apellidos: ['', Validators.required],
    email: ['', emailRequired],
  });

  tipoUsuarioForm = this.fb.group({
    tipo: ['', Validators.required],
  });

  codigoClinicaForm = this.fb.group({
    codigo: [''],
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
        tipo: this.tipoUsuarioForm.value.tipo as 'fisioterapeuta' | 'paciente',
        codigo_clinica: this.codigoClinicaForm.value.codigo?.trim() || undefined,
      };

      const result = await this.authService.register(payload);

      if (!result.success) {
        this.handleRegistroError(result.code);
        return;
      }

      // Auto-login tras registro exitoso
      await this.authService.login(payload.email, payload.password);
      this.router.navigate(['/inicio']);
    } catch (err: unknown) {
      // Manejar errores HTTP
      const httpError = err as { error?: { code?: RegistroErrorCode } };
      if (httpError.error?.code) {
        this.handleRegistroError(httpError.error.code);
      } else {
        this.error.set('Error de conexion. Por favor, intenta de nuevo.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private handleRegistroError(code: RegistroErrorCode): void {
    switch (code) {
      case 'EMAIL_DUPLICADO':
        this.error.set('Este email ya esta registrado. Intenta iniciar sesion o usa otro email.');
        break;
      case 'CLINICA_NO_ENCONTRADA':
        this.error.set('El codigo de clinica no es valido. Verifica el codigo o dejalo en blanco.');
        break;
      case 'VALIDATION_ERROR':
        this.error.set('Los datos ingresados no son validos. Revisa el formulario.');
        break;
      case 'SERVER_ERROR':
      default:
        this.error.set('Error del servidor. Por favor, intenta mas tarde.');
        break;
    }
  }

  // Mensajes de error por campo (devuelven string | undefined para ui-input)
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
    if (ctrl.hasError('email')) return 'El formato del email no es valido';
    return undefined;
  }

  get passwordError(): string | undefined {
    const ctrl = this.passwordForm.get('password');
    if (!ctrl || !ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'La contrasena es requerida';
    if (ctrl.hasError('minlength')) return 'Debe tener al menos 8 caracteres';
    return undefined;
  }

  get repetirError(): string | undefined {
    const ctrl = this.passwordForm.get('repetir');
    if (!ctrl || !ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'Repetir la contrasena es requerido';
    if (!this.passwordsMatch) return 'Las contrasenas no coinciden';
    return undefined;
  }

  get passwordsMatch(): boolean {
    return this.passwordForm.value.password === this.passwordForm.value.repetir;
  }
}
