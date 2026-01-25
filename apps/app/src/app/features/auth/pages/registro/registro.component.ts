import { Component, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { StepperComponent, StepComponent } from '../../../../shared';

@Component({
  standalone: true,
  selector: 'app-registro',
  imports: [
    CommonModule,
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

  currentStep = signal(0);
  error = signal<string | null>(null);

  // Formularios:
  datosForm: FormGroup;
  tipoUsuarioForm: FormGroup;
  codigoClinicaForm: FormGroup;
  passwordForm: FormGroup;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
  ) {
    this.datosForm = this.fb.group({
      nombre: ['', Validators.required],
      apellidos: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
    });

    this.tipoUsuarioForm = this.fb.group({
      tipo: ['', Validators.required],
    });

    this.codigoClinicaForm = this.fb.group({
      codigo: [''],
    });

    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      repetir: ['', Validators.required],
    });
  }

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

  completarRegistro(): void {
    if (
      this.passwordForm.valid &&
      this.passwordForm.value.password === this.passwordForm.value.repetir
    ) {
      const registroCompleto = {
        ...this.datosForm.value,
        ...this.tipoUsuarioForm.value,
        ...this.codigoClinicaForm.value,
        password: this.passwordForm.value.password,
      };
      console.log('Formulario completo:', registroCompleto);
      // aquí podrías llamar a tu API
    }
  }

  get passwordsMatch(): boolean {
    return this.passwordForm.value.password === this.passwordForm.value.repetir;
  }
}
