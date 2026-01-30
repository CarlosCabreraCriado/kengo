import { Component, inject, signal, ViewChild } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { StepperComponent, StepComponent, passwordMatchValidator } from '../../../../shared';
import type { CreateUsuarioPayload, RegistroErrorCode } from '@kengo/shared-models';

@Component({
  standalone: true,
  selector: 'app-registro',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    StepperComponent,
    StepComponent,
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

  // Formularios:
  datosForm = this.fb.group({
    nombre: ['', Validators.required],
    apellidos: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  tipoUsuarioForm = this.fb.group({
    tipo: ['', Validators.required],
  });

  codigoClinicaForm = this.fb.group({
    codigo: [''],
  });

  passwordForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    repetir: ['', Validators.required],
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

  // Getters para validacion
  get nombreInvalid(): boolean {
    const control = this.datosForm.get('nombre');
    return !!control && control.invalid && control.touched;
  }

  get apellidosInvalid(): boolean {
    const control = this.datosForm.get('apellidos');
    return !!control && control.invalid && control.touched;
  }

  get emailInvalid(): boolean {
    const control = this.datosForm.get('email');
    return !!control && control.invalid && control.touched;
  }

  get emailError(): string {
    const control = this.datosForm.get('email');
    if (!control || !control.touched) return '';
    if (control.hasError('required')) return 'El email es requerido';
    if (control.hasError('email')) return 'El formato del email no es valido';
    return '';
  }

  get passwordInvalid(): boolean {
    const control = this.passwordForm.get('password');
    return !!control && control.invalid && control.touched;
  }

  get passwordError(): string {
    const control = this.passwordForm.get('password');
    if (!control || !control.touched) return '';
    if (control.hasError('required')) return 'La contrasena es requerida';
    if (control.hasError('minlength')) return 'Debe tener al menos 6 caracteres';
    return '';
  }

  get repetirInvalid(): boolean {
    const control = this.passwordForm.get('repetir');
    return !!control && control.invalid && control.touched;
  }

  get passwordsMatch(): boolean {
    return this.passwordForm.value.password === this.passwordForm.value.repetir;
  }
}
