import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  emailRequired,
  InputComponent,
  ButtonComponent,
  SpinnerComponent,
} from '../../../../shared';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    InputComponent,
    ButtonComponent,
    SpinnerComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);
  verificandoSesion = signal(true);

  async ngOnInit(): Promise<void> {
    if (history.state?.fromLogout) {
      this.verificandoSesion.set(false);
      return;
    }
    const hasSession = await this.auth.checkSession();
    if (hasSession) {
      this.router.navigateByUrl('/inicio');
      return;
    }
    this.verificandoSesion.set(false);
  }

  public loginForm = this.fb.group({
    email: ['', emailRequired],
    password: ['', Validators.required],
  });

  get email() {
    return this.loginForm.controls.email;
  }
  get password() {
    return this.loginForm.controls.password;
  }

  get emailError(): string | undefined {
    const ctrl = this.loginForm.controls.email;
    if (!ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'El email es obligatorio.';
    if (ctrl.hasError('email')) return 'Ingresa un email válido.';
    return undefined;
  }

  get passwordError(): string | undefined {
    const ctrl = this.loginForm.controls.password;
    if (!ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'La contraseña es obligatoria.';
    return undefined;
  }

  async onSubmit() {
    console.warn('LOGIN');

    if (this.loginForm.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    const { email, password } = this.loginForm.getRawValue();

    try {
      await this.auth.login(email!, password!);
      await this.router.navigateByUrl('/inicio');
    } catch (err) {
      // Si falla con 401, la cookie expirada puede no haberse limpiado a tiempo — reintentar una vez
      if (err instanceof HttpErrorResponse && err.status === 401) {
        try {
          await this.auth.login(email!, password!);
          await this.router.navigateByUrl('/inicio');
          return;
        } catch {
          // El reintento también falló
        }
      }
      this.error.set('No se pudo iniciar sesión. Verifica tus credenciales.');
    } finally {
      this.loading.set(false);
    }
  }
}
