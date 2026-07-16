import { Injectable, Injector, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { DialogService } from '../../shared/services/dialog/dialog.service';
import { SessionService } from '../auth/services/session.service';
import { SubscriptionService } from './subscription.service';

/**
 * Captura el error `ConvexError({ code: "SUBSCRIPTION_INACTIVE" })` lanzado por
 * el backend cuando un fisio intenta una operación de escritura sin que su
 * clínica tenga suscripción operativa, y muestra un diálogo de confirmación
 * con CTA para llevar al usuario a la pantalla de gestión.
 *
 * Diseñado para enchufarse en `ConvexService.mutation/action` como interceptor
 * global, de modo que ningún componente necesite conocer este código de error
 * para mostrar feedback uniforme al usuario.
 *
 * Idempotente entre llamadas concurrentes: si ya hay un diálogo abierto, las
 * llamadas posteriores no abren otro.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionGateService {
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  // Resolución lazy para evitar el ciclo Gate → Subscription → Convex → Gate.
  private readonly injector = inject(Injector);

  private readonly mostrando = signal(false);

  /**
   * Detecta si `err` corresponde a una suscripción inactiva. Si es así, muestra
   * el diálogo de aviso y devuelve `true` (para que el caller no pinte un
   * toast genérico encima). Devuelve `false` para cualquier otro error.
   */
  handle(err: unknown): boolean {
    if (!this.esSubscriptionInactive(err)) return false;

    // En modo paciente nunca se debería disparar (el backend solo lanza este
    // error en operaciones de fisio), pero por defensa no mostramos el diálogo.
    if (this.session.enModoPaciente()) return true;

    void this.mostrarDialog();
    return true;
  }

  private esSubscriptionInactive(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { data?: { code?: string }; message?: string };
    return e.data?.code === 'SUBSCRIPTION_INACTIVE';
  }

  private async mostrarDialog(): Promise<void> {
    if (this.mostrando()) return;
    this.mostrando.set(true);
    try {
      const subs = this.injector.get(SubscriptionService);

      // M-6: solo el admin de la clínica activa puede reactivar el pago. Para
      // el fisio no-admin, la ruta /mi-clinica/suscripcion la bloquea el guard
      // de admin, así que mostramos un aviso informativo indicándole a quién
      // avisar, sin CTA de navegación (que sería un callejón sin salida).
      if (!subs.esAdminEnClinicaActiva()) {
        const owner = subs.ownerNombre();
        await this.dialog.confirm({
          title: 'Suscripción de la clínica inactiva',
          message: owner
            ? `Avisa a ${owner} para reactivar la suscripción de la clínica.`
            : 'Avisa al responsable de la clínica para reactivar la suscripción.',
          confirmText: 'Entendido',
          hideCancel: true,
          confirmVariant: 'primary',
        });
        return;
      }

      const ir = await this.dialog.confirm({
        title: 'Tu suscripción no está activa',
        message:
          'Para continuar con esta acción, reactiva la suscripción de tu clínica.',
        confirmText: 'Reactivar suscripción',
        cancelText: 'Cerrar',
        confirmVariant: 'primary',
      });
      if (ir) {
        await this.router.navigate(['/mi-clinica/suscripcion'], {
          queryParams: { bloqueada: '1' },
        });
      }
    } finally {
      this.mostrando.set(false);
    }
  }
}
