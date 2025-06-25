import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

// Formulario Angular:
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

// UI Angular Material:
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { MatRadioModule } from '@angular/material/radio';

@Component({
  standalone: true,
  selector: 'app-registro',
  imports: [
    MatStepperModule,
    MatButtonModule,
    MatRadioModule,
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css',
})
export class RegistroComponent {
  public loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  public error = '';

  //Formularios:
  public datosForm: FormGroup;
  public tipoUsuarioForm: FormGroup;
  public codigoClinicaForm: FormGroup;
  public passwordForm: FormGroup;

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

  completarRegistro() {
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
}
