import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { AuthService } from '../../../../core/auth/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-reset-password',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  reenviando = signal(false);
  exito = signal(false);
  error = signal<string | null>(null);
  email = signal<string>('');

  form = this.fb.group(
    {
      codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator },
  );

  get codigo() {
    return this.form.controls.codigo;
  }
  get password() {
    return this.form.controls.password;
  }
  get confirmPassword() {
    return this.form.controls.confirmPassword;
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['email']) {
        this.email.set(params['email']);
      }
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (
      password &&
      confirmPassword &&
      password.value !== confirmPassword.value
    ) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  async onSubmit() {
    if (this.form.invalid || this.loading() || !this.email()) return;

    this.error.set(null);
    this.loading.set(true);

    const { codigo, password } = this.form.getRawValue();

    try {
      const result = await this.auth.resetPassword(
        this.email(),
        codigo!,
        password!,
      );

      if (result.success) {
        this.exito.set(true);
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      } else {
        this.error.set(result.message || 'Error al restablecer la contrasena');
      }
    } catch {
      this.error.set('Error al restablecer la contrasena. Intentalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  async reenviarCodigo() {
    if (this.reenviando() || !this.email()) return;

    this.error.set(null);
    this.reenviando.set(true);

    try {
      await this.auth.solicitarRecuperacion(this.email());
      this.error.set(null);
    } catch {
      this.error.set('Error al reenviar el codigo');
    } finally {
      this.reenviando.set(false);
    }
  }
}
