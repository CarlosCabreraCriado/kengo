import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { ConvexService } from '../convex/convex.service';
import { LoggerService } from '../services/logger.service';
import { ToastService } from '../../shared/services/toast/toast.service';
import { esErrorYaGestionado } from './subscription-gate.service';
import { api } from '../../../../../../convex/_generated/api';
import type { MetodoDePagoAportado } from '@kengo/shared-models';

/**
 * Tarjetas que el usuario autenticado ha aportado a clínicas (titularidad
 * del método de pago). No depende de la clínica activa ni de ser miembro:
 * la titularidad sobrevive a salir de la clínica o a dejar de ser owner, y
 * por eso vive en "Mi cuenta" y no en "Mi clínica".
 *
 * Retirar una tarjeta no es una compra, así que —como `cancelar()`— no se
 * gatea con `pagosSoloWeb`.
 */
@Injectable({ providedIn: 'root' })
export class PaymentMethodsService {
  private readonly convex = inject(ConvexService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);

  private readonly query = this.convex.watchQuery(
    api.billing.queries.listMisMetodosDePago,
    () => ({}),
  );

  public readonly tarjetas: Signal<MetodoDePagoAportado[]> = computed(
    () => (this.query.value() as MetodoDePagoAportado[] | undefined) ?? [],
  );
  public readonly loading = this.query.isLoading;
  public readonly error = this.query.error;

  private readonly _retirando = signal<string | null>(null);
  /** Id de la tarjeta cuya retirada está en vuelo (para `[loading]`). */
  public readonly retirando = this._retirando.asReadonly();

  /** Tarjetas vivas del usuario en una clínica concreta. */
  public deClinica(clinicId: string): MetodoDePagoAportado[] {
    return this.tarjetas().filter((t) => t.clinicId === clinicId);
  }

  /**
   * Desvincula la tarjeta en Stripe. Devuelve `true` si se retiró. La clínica
   * sigue operando hasta la siguiente renovación; si era la activa, el
   * backend avisa al owner.
   */
  async retirar(pm: MetodoDePagoAportado): Promise<boolean> {
    if (this._retirando()) return false;
    this._retirando.set(pm.id);
    try {
      const { eraActiva } = await this.convex.action(
        api.billing.actions.retirarMiMetodoDePago,
        { stripePaymentMethodId: pm.id },
      );
      this.toast.success(
        eraActiva
          ? `Tarjeta retirada. Hemos avisado al propietario de ${pm.clinicaNombre}.`
          : 'Tarjeta retirada',
      );
      return true;
    } catch (err) {
      if (!esErrorYaGestionado(err)) {
        const code = (err as { data?: { code?: string } })?.data?.code;
        this.logger.error('[PaymentMethodsService] retirar', err);
        this.toast.error(
          code === 'PM_ALREADY_DETACHED'
            ? 'Esta tarjeta ya se había retirado.'
            : code === 'PM_NOT_CONTRIBUTOR'
              ? 'Solo quien aportó la tarjeta puede retirarla.'
              : 'No se pudo retirar la tarjeta',
        );
      }
      return false;
    } finally {
      this._retirando.set(null);
    }
  }
}
