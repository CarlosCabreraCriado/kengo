import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { emailRequired } from '../../../../shared';
import {
  Ui2CreamBgComponent,
  Ui2CardComponent,
  Ui2BigTitleComponent,
  Ui2InputComponent,
  Ui2ButtonComponent,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';

@Component({
  standalone: true,
  selector: 'app-recuperar-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    Ui2CreamBgComponent,
    Ui2CardComponent,
    Ui2BigTitleComponent,
    Ui2InputComponent,
    Ui2ButtonComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './recuperar-password.component.html',
  styleUrl: './recuperar-password.component.css',
})
export class RecuperarPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  enviado = signal(false);
  error = signal<string | null>(null);

  form = this.fb.group({
    email: ['', emailRequired],
  });

  get email() {
    return this.form.controls.email;
  }

  get emailError(): string | undefined {
    const ctrl = this.form.controls.email;
    if (!ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'El email es obligatorio.';
    if (ctrl.hasError('email')) return 'Ingresa un email válido.';
    return undefined;
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.error.set(null);
    this.loading.set(true);

    const email = this.form.getRawValue().email!;

    try {
      await this.auth.solicitarRecuperacion(email);
      this.enviado.set(true);

      setTimeout(() => {
        this.router.navigate(['/reset-password'], {
          queryParams: { email },
        });
      }, 2000);
    } catch {
      this.error.set('Error al enviar el código. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
