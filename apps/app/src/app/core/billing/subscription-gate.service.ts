import { Injectable, Injector, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { DialogService } from '../../shared/services/dialog/dialog.service';
import { SessionService } from '../auth/services/session.service';
import { SubscriptionService } from './subscription.service';

/**
 * `true` si el error ya lo ha atendido `SubscriptionGateService` con su propio
 * diálogo, de modo que el `catch` del caller no debe mostrar nada encima.
 *
 * Hace falta porque `ConvexService.mutation/action` pasa el error por el gate y
 * lo **re-lanza** (el caller necesita el error para no seguir adelante), así que
 * el `true` que devuelve `handle()` nunca llega a quien escribe el `catch`.
 * Sin este guard, un `catch → toast.error('No se pudo …')` genérico se pinta
 * sobre el diálogo del gate y el usuario recibe dos avisos del mismo hecho.
 *
 * Función suelta y no método: los bloques `catch` que la necesitan están en
 * componentes que no tienen por qué inyectar el gate entero.
 */
export function esErrorYaGestionado(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  return (err as { data?: { code?: string } }).data?.code === 'SUBSCRIPTION_INACTIVE';
}

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
    if (!esErrorYaGestionado(err)) return false;

    // En modo paciente nunca se debería disparar (el backend solo lanza este
    // error en operaciones de fisio), pero por defensa no mostramos el diálogo.
    if (this.session.enModoPaciente()) return true;

    void this.mostrarDialog();
    return true;
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

      // En nativo no hay CTA de reactivación (políticas de pagos de las
      // stores): aviso con copy de gestión web y navegación solo al estado.
      if (subs.pagosSoloWeb()) {
        const ver = await this.dialog.confirm({
          title: 'Tu suscripción no está activa',
          message:
            'La suscripción de tu clínica se gestiona desde la versión web de Kengo. ' +
            'Puedes consultar su estado en la pantalla de suscripción.',
          confirmText: 'Ver estado',
          cancelText: 'Cerrar',
          confirmVariant: 'primary',
        });
        if (ver) {
          await this.router.navigate(['/mi-clinica/suscripcion'], {
            queryParams: { bloqueada: '1' },
          });
        }
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
