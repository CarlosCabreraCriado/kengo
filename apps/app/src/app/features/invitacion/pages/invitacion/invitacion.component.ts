import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../../core/auth/services/auth.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { ClinicaGestionService } from '../../../clinica/data-access/clinica-gestion.service';
import { ToastService } from '../../../../shared/services/toast/toast.service';
import { api } from '../../../../../../../../convex/_generated/api';
import {
  Ui2CreamBgComponent,
  Ui2CardComponent,
  Ui2BigTitleComponent,
  Ui2ButtonComponent,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';

type InvitacionEstado =
  | 'verificando'
  | 'invalido'
  | 'sin_match'
  | 'ya_vinculado'
  | 'error';

/**
 * Pasarela `/invitacion?codigo=X&email=Y` para invitaciones de fisio.
 *
 * Flujo:
 *   1. Si faltan params → estado `invalido`.
 *   2. Sesión activa con el mismo email → canje silencioso vía
 *      `ClinicaGestionService.vincularConCodigo`. Éxito navega a `/inicio`.
 *   3. Sesión activa con otro email → estado `sin_match` con CTA logout.
 *   4. Sin sesión → consultar `auth.userExistsByEmail`:
 *       - existe  → `/login?email=…&next=/invitacion?…`
 *       - no existe → `/registro?email=…&codigo=…`
 */
@Component({
  standalone: true,
  selector: 'app-invitacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2CreamBgComponent,
    Ui2CardComponent,
    Ui2BigTitleComponent,
    Ui2ButtonComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './invitacion.component.html',
  styleUrl: './invitacion.component.css',
})
export class InvitacionComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private sessionService = inject(SessionService);
  private convex = inject(ConvexService);
  private clinicaGestionService = inject(ClinicaGestionService);
  private toastService = inject(ToastService);

  estado = signal<InvitacionEstado>('verificando');
  errorMensaje = signal<string | null>(null);
  emailInvitacion = signal<string>('');
  emailSesion = signal<string>('');

  private codigo = '';

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const codigoRaw = params.get('codigo')?.trim().toUpperCase() ?? '';
    const emailRaw = params.get('email')?.trim().toLowerCase() ?? '';

    if (!codigoRaw || !emailRaw) {
      this.estado.set('invalido');
      return;
    }

    this.codigo = codigoRaw;
    this.emailInvitacion.set(emailRaw);

    // Esperar a que la hidratación de sesión termine (mismo gate que AuthGuard).
    await this.auth.iniciarApp();

    const usuario = this.sessionService.usuario();
    if (usuario) {
      const emailUsuario = (usuario.email ?? '').toLowerCase();
      this.emailSesion.set(emailUsuario);
      if (emailUsuario === emailRaw) {
        await this.canjear();
      } else {
        this.estado.set('sin_match');
      }
      return;
    }

    // Sin sesión: descubrir si el email tiene cuenta para decidir destino.
    try {
      const result = await this.convex.query(
        api.auth.queries.userExistsByEmail,
        { email: emailRaw },
        { requireAuth: false },
      );
      const destino = this.buildInvitacionUrl(codigoRaw, emailRaw);
      if (result.exists) {
        this.router.navigateByUrl(
          `/login?email=${encodeURIComponent(emailRaw)}` +
            `&next=${encodeURIComponent(destino)}`,
        );
      } else {
        this.router.navigateByUrl(
          `/registro?email=${encodeURIComponent(emailRaw)}` +
            `&codigo=${encodeURIComponent(codigoRaw)}`,
        );
      }
    } catch {
      this.estado.set('error');
      this.errorMensaje.set(
        'No hemos podido procesar la invitación. Inténtalo de nuevo más tarde.',
      );
    }
  }

  private buildInvitacionUrl(codigo: string, email: string): string {
    return (
      `/invitacion?codigo=${encodeURIComponent(codigo)}` +
      `&email=${encodeURIComponent(email)}`
    );
  }

  private async canjear(): Promise<void> {
    const result = await this.clinicaGestionService.vincularConCodigo(
      this.codigo,
    );

    if (result.success) {
      const mensaje = result.promovido
        ? result.nombreClinica
          ? `Ahora eres fisioterapeuta en ${result.nombreClinica}`
          : 'Ahora eres fisioterapeuta en la clínica'
        : result.nombreClinica
          ? `Te has unido a ${result.nombreClinica}`
          : 'Te has unido a la clínica';
      this.toastService.success(mensaje);
      this.router.navigateByUrl('/inicio');
      return;
    }

    // Mapeo de errores conocidos del consume → UI dedicada.
    const codigoError = (result as { errorCode?: string }).errorCode ?? '';
    if (codigoError === 'YA_VINCULADO') {
      this.estado.set('ya_vinculado');
      return;
    }
    this.estado.set('error');
    this.errorMensaje.set(
      result.error ||
        'No hemos podido aplicar la invitación. Pide a quien te invitó que te reenvíe el enlace.',
    );
  }

  async cambiarCuenta(): Promise<void> {
    // Tras el logout volvemos a abrir la misma URL para que el flujo decida
    // si redirigir a login o a registro con el email correcto.
    const destino = this.buildInvitacionUrl(
      this.codigo,
      this.emailInvitacion(),
    );
    await this.auth.logout(true);
    this.router.navigateByUrl(destino);
  }

  irAlInicio(): void {
    this.router.navigateByUrl('/inicio');
  }

  irAlLogin(): void {
    this.router.navigateByUrl('/login');
  }
}
