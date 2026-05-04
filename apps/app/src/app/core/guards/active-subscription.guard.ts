import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

import { SessionService } from '../auth/services/session.service';
import { SubscriptionService } from '../billing/subscription.service';

/**
 * Bloquea el acceso a rutas de creación/edición cuando la suscripción de la
 * clínica está suspendida (`unpaid`) o el período de gracia ha expirado.
 *
 * Pacientes nunca se ven afectados — su acceso a sus rutinas/sesiones es
 * independiente del estado de pago de la clínica.
 *
 * Cuando bloquea, redirige a `/mi-clinica/suscripcion?bloqueada=1` para que
 * el admin pueda resolver el pago y reactivar el acceso.
 */
@Injectable({ providedIn: 'root' })
export class ActiveSubscriptionGuard implements CanActivate {
  private readonly session = inject(SessionService);
  private readonly subs = inject(SubscriptionService);
  private readonly router = inject(Router);

  async canActivate(): Promise<boolean | UrlTree> {
    if (this.session.enModoPaciente()) return true;

    if (!this.session.usuario()) {
      await this.session.cargarMiUsuario();
    }

    if (!this.subs.bloqueada()) return true;

    return this.router.createUrlTree(['/mi-clinica/suscripcion'], {
      queryParams: { bloqueada: '1' },
    });
  }
}
