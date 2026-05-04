import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import {
  passwordMatchValidator,
  passwordRequired,
  passwordRepeatRequired,
} from '../../../../shared';
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
  selector: 'app-establecer-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Ui2CreamBgComponent,
    Ui2CardComponent,
    Ui2BigTitleComponent,
    Ui2InputComponent,
    Ui2ButtonComponent,
    Ui2SpinnerComponent,
  ],
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
      password: ['', passwordRequired()],
      repetir: ['', passwordRepeatRequired],
    },
    { validators: passwordMatchValidator() },
  );

  get password() {
    return this.form.controls.password;
  }
  get repetir() {
    return this.form.controls.repetir;
  }

  get passwordError(): string | undefined {
    const ctrl = this.form.controls.password;
    if (!ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'La contraseña es obligatoria.';
    if (ctrl.hasError('minlength')) return 'Debe tener al menos 8 caracteres.';
    return undefined;
  }

  get repetirError(): string | undefined {
    const ctrl = this.form.controls.repetir;
    if (!ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'Debes repetir la contraseña.';
    if (ctrl.hasError('passwordMismatch')) return 'Las contraseñas no coinciden.';
    return undefined;
  }

  ngOnInit() {
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
      await this.auth.establecerPassword(password!);

      if (this.email) {
        await this.auth.login(this.email, password!);
      }

      await this.router.navigateByUrl('/inicio');
    } catch {
      this.error.set('No se pudo establecer la contraseña. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
