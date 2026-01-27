import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-recuperar-password',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './recuperar-password.component.html',
})
export class RecuperarPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  enviado = signal(false);
  error = signal<string | null>(null);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get email() {
    return this.form.controls.email;
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.error.set(null);
    this.loading.set(true);

    const email = this.form.getRawValue().email!;

    try {
      await this.auth.solicitarRecuperacion(email);
      this.enviado.set(true);

      // Navegar a reset-password con el email como query param
      setTimeout(() => {
        this.router.navigate(['/reset-password'], {
          queryParams: { email },
        });
      }, 2000);
    } catch {
      this.error.set('Error al enviar el codigo. Intentalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
