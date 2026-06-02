import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { AuthService } from '../../../../core/auth/services/auth.service';
import {
  otpCode,
  passwordRequired,
  passwordRepeatRequired,
  passwordMatchValidator,
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
  selector: 'app-reset-password',
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
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  loading = signal(false);
  reenviando = signal(false);
  exito = signal(false);
  error = signal<string | null>(null);
  email = signal<string>('');

  form = this.fb.group(
    {
      codigo: ['', otpCode()],
      password: ['', passwordRequired()],
      confirmPassword: ['', passwordRepeatRequired],
    },
    { validators: passwordMatchValidator('password', 'confirmPassword') },
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

  get codigoError(): string | undefined {
    const ctrl = this.form.controls.codigo;
    if (!ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'El código es obligatorio.';
    if (ctrl.hasError('pattern')) return 'El código debe tener 6 dígitos.';
    return undefined;
  }

  get passwordError(): string | undefined {
    const ctrl = this.form.controls.password;
    if (!ctrl.touched) return undefined;
    if (ctrl.hasError('required')) return 'La contraseña es obligatoria.';
    if (ctrl.hasError('minlength')) return 'Mínimo 8 caracteres.';
    return undefined;
  }

  get confirmPasswordError(): string | undefined {
    const ctrl = this.form.controls.confirmPassword;
    if (!ctrl.touched) return undefined;
    if (ctrl.hasError('passwordMismatch')) return 'Las contraseñas no coinciden.';
    return undefined;
  }

  ngOnInit() {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
      if (params['email']) {
        this.email.set(params['email']);
      }
    });
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
        this.error.set(result.message || 'Error al restablecer la contraseña');
      }
    } catch {
      this.error.set('Error al restablecer la contraseña. Inténtalo de nuevo.');
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
      this.error.set('Error al reenviar el código');
    } finally {
      this.reenviando.set(false);
    }
  }
}
