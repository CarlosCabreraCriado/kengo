import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

// Formulario Angular:
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

// UI Angular Material:
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [
    MatButtonModule,
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);

  public loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  get email() {
    return this.loginForm.controls.email;
  }
  get password() {
    return this.loginForm.controls.password;
  }

  async onSubmit() {
    if (this.loginForm.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    const { email, password } = this.loginForm.getRawValue();

    try {
      // --- LLAMADA DE LOGIN DESDE EL COMPONENTE ---
      // Elige una:
      // await this.auth.loginJson(email!, password!);        // solo tokens
      // await this.auth.loginSession(email!, password!);     // solo cookie
      await this.auth.login(email!, password!); // híbrido recomendado si compartes dominio

      // Redirige (ajusta a tu app)
      await this.router.navigateByUrl('/inicio');
    } catch (e: unknown) {
      this.error.set('No se pudo iniciar sesión');
      console.error('Login error', e);
      /*
      this.error.set(
        e?.error?.errors?.[0]?.message ?? 'No se pudo iniciar sesión',
      );
      */
    } finally {
      this.loading.set(false);
    }
  }
}
