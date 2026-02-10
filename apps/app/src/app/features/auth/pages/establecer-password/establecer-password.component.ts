import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { passwordMatchValidator } from '../../../../shared/validators/password-match.validator';

@Component({
  standalone: true,
  selector: 'app-establecer-password',
  imports: [ReactiveFormsModule],
  templateUrl: './establecer-password.component.html',
  styleUrl: './establecer-password.component.css',
})
export class EstablecerPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private sessionService = inject(SessionService);

  loading = signal(false);
  error = signal<string | null>(null);

  private email = '';

  form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(6)]],
      repetir: ['', Validators.required],
    },
    { validators: passwordMatchValidator() },
  );

  get password() {
    return this.form.controls.password;
  }
  get repetir() {
    return this.form.controls.repetir;
  }

  ngOnInit() {
    // Obtener email del state de navegación o del usuario cargado en sesión
    const nav = this.router.getCurrentNavigation();
    this.email = nav?.extras.state?.['email'] ?? '';

    if (!this.email) {
      this.email = this.sessionService.usuario()?.email ?? '';
    }
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.error.set(null);
    this.loading.set(true);

    const { password } = this.form.getRawValue();

    try {
      // 1. Establecer contraseña
      await this.auth.establecerPassword(password!);

      // 2. Auto-login con email + nueva contraseña
      if (this.email) {
        await this.auth.login(this.email, password!);
      }

      // 3. Redirigir a inicio
      await this.router.navigateByUrl('/inicio');
    } catch {
      this.error.set('No se pudo establecer la contraseña. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
