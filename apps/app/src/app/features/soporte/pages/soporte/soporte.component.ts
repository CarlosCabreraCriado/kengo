import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Ui2ButtonComponent,
  Ui2InputComponent,
  Ui2CardComponent,
  Ui2BigTitleComponent,
} from '../../../../shared/ui-v2';
import { ToastService } from '../../../../shared';
import { ConvexService } from '../../../../core/convex/convex.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { api } from '../../../../../../../../convex/_generated/api';

interface TargetEncontrado {
  externalId: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Pantalla de soporte (solo técnicos): busca un usuario por email y permite
 * impersonarlo para reproducir errores desde su cuenta. El acceso lo protege
 * `SoporteGuard`; la búsqueda y la impersonación están además gateadas en el
 * servidor.
 */
@Component({
  selector: 'app-soporte',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Ui2ButtonComponent,
    Ui2InputComponent,
    Ui2CardComponent,
    Ui2BigTitleComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-xl flex-col gap-5 px-5 py-6">
      <ui2-big-title overline="Soporte técnico" title="Impersonar usuario" />

      <ui2-card>
        <form class="flex flex-col gap-4" (ngSubmit)="buscar()">
          <ui2-input
            label="Email del usuario"
            type="email"
            placeholder="usuario@ejemplo.com"
            [formControl]="emailCtrl"
          />
          <ui2-button
            type="submit"
            variant="secondary"
            iconLeft="search"
            [loading]="buscando()"
            (clicked)="buscar()"
          >
            Buscar usuario
          </ui2-button>
        </form>
      </ui2-card>

      @if (target(); as t) {
        <ui2-card variant="tinted">
          <div class="flex flex-col gap-3">
            <div>
              <p class="text-ink-900 text-lg font-semibold">
                {{ t.firstName }} {{ t.lastName }}
              </p>
              <p class="text-ink-500 text-sm">{{ t.email }}</p>
            </div>
            <p class="text-ink-700 text-sm">
              Vas a iniciar sesión <strong>como este usuario</strong>. Verás su
              app tal cual y cualquier acción que realices se ejecutará en su
              cuenta. Quedará registrado en la auditoría.
            </p>
            <ui2-button
              variant="primary"
              iconLeft="visibility"
              [loading]="impersonando()"
              (clicked)="impersonar()"
            >
              Impersonar a {{ t.firstName }}
            </ui2-button>
          </div>
        </ui2-card>
      }
    </div>
  `,
})
export class SoporteComponent {
  private convex = inject(ConvexService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  readonly emailCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  readonly buscando = signal(false);
  readonly impersonando = signal(false);
  readonly target = signal<TargetEncontrado | null>(null);

  async buscar(): Promise<void> {
    if (this.emailCtrl.invalid) {
      this.toast.error('Introduce un email válido.');
      return;
    }
    this.buscando.set(true);
    this.target.set(null);
    try {
      const res = await this.convex.query(
        api.impersonation.queries.lookupTarget,
        { email: this.emailCtrl.value.trim() },
      );
      if (!res) {
        this.toast.error(
          'No se encontró un usuario impersonable con ese email.',
        );
        return;
      }
      this.target.set(res as TargetEncontrado);
    } catch {
      this.toast.error('Error al buscar el usuario.');
    } finally {
      this.buscando.set(false);
    }
  }

  async impersonar(): Promise<void> {
    const t = this.target();
    if (!t) return;
    this.impersonando.set(true);
    try {
      await this.auth.impersonar({
        externalId: t.externalId,
        email: t.email,
        nombre: `${t.firstName} ${t.lastName}`.trim(),
      });
      // `impersonar()` navega a /inicio al terminar.
    } catch (err) {
      const msg = (err as Error)?.message;
      this.toast.error(
        msg === 'IMPERSONACION_NO_AUTORIZADA'
          ? 'No tienes permiso para impersonar a este usuario.'
          : 'No se pudo iniciar la impersonación.',
      );
      this.impersonando.set(false);
    }
  }
}
