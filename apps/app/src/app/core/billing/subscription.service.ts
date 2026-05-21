import { Injectable, computed, inject, type Signal } from '@angular/core';
import { ConvexService } from '../convex/convex.service';
import { SessionService } from '../auth/services/session.service';
import { ClinicaActivaService } from '../auth/services/clinica-activa.service';
import { ExternalBrowserService } from '../services/external-browser.service';
import { PlatformService } from '../services/platform.service';
import { ToastService } from '../../shared/services/toast/toast.service';
import { api } from '../../../../../../convex/_generated/api';
import type { ClinicSubscription } from '@kengo/shared-models';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Estado reactivo de la suscripción de la clínica activa.
 *
 * Resuelve la suscripción de la **clínica activa** (`ClinicaActivaService`)
 * cuando el usuario tiene puesto `admin` en ella. Si el puesto activo no es
 * admin (paciente o fisio), no expone billing porque solo el admin puede
 * gestionarlo.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly convex = inject(ConvexService);
  private readonly session = inject(SessionService);
  private readonly clinicaActiva = inject(ClinicaActivaService);
  private readonly toast = inject(ToastService);
  private readonly externalBrowser = inject(ExternalBrowserService);
  private readonly platform = inject(PlatformService);

  private get returnTo(): 'native' | 'web' {
    return this.platform.isNative() ? 'native' : 'web';
  }

  /**
   * ID de la clínica activa cuando el usuario es admin en ella. `null` en
   * cualquier otro caso (sin clínica activa, o admin en otra clínica que
   * no es la activa actualmente).
   */
  public readonly clinicIdAdmin = computed<string | null>(() => {
    const id = this.clinicaActiva.selectedClinicaId();
    if (!id) return null;
    const m = this.session.misclinicas().find((c) => c.clinicId === id);
    return m?.puesto === 'admin' ? id : null;
  });

  private readonly query = this.convex.watchQuery(
    api.billing.queries.getMyClinicSubscription,
    () => {
      const id = this.clinicIdAdmin();
      return id ? { clinicId: id as never } : 'skip';
    },
  );

  public readonly suscripcion: Signal<ClinicSubscription | undefined> =
    this.query.value as Signal<ClinicSubscription | undefined>;
  public readonly loading = this.query.isLoading;
  public readonly error = this.query.error;

  public readonly enTrial = computed(
    () => this.suscripcion()?.estado === 'trialing',
  );

  public readonly diasRestantesTrial = computed<number>(() => {
    const sub = this.suscripcion();
    if (!sub?.trialEnd) return 0;
    const ms = sub.trialEnd - Date.now();
    return Math.max(0, Math.ceil(ms / DIA_MS));
  });

  public readonly enPeriodoGracia = computed(() => {
    const sub = this.suscripcion();
    if (!sub) return false;
    return (
      sub.estado === 'past_due' &&
      typeof sub.graceUntil === 'number' &&
      sub.graceUntil > Date.now()
    );
  });

  public readonly tieneAccesoActivo = computed(() => {
    const sub = this.suscripcion();
    if (!sub) return true;
    if (sub.estado === 'trialing' || sub.estado === 'active') return true;
    if (sub.estado === 'past_due' && this.enPeriodoGracia()) return true;
    return false;
  });

  public readonly bloqueada = computed(() => {
    const sub = this.suscripcion();
    if (!sub) return false;
    if (sub.estado === 'unpaid') return true;
    if (sub.estado === 'past_due' && !this.enPeriodoGracia()) return true;
    return false;
  });

  public readonly cancelaAlFinDelPeriodo = computed(
    () => this.suscripcion()?.cancelAtPeriodEnd === true,
  );

  /** Inicia Checkout de Stripe y redirige al usuario. */
  async iniciarCheckout(clinicId: string): Promise<void> {
    try {
      const { url } = await this.convex.action(
        api.billing.actions.createCheckoutSession,
        { clinicId: clinicId as never, returnTo: this.returnTo },
      );
      await this.externalBrowser.redirect(url);
    } catch (err) {
      console.error('[SubscriptionService] checkout', err);
      this.toast.error('No se pudo iniciar el proceso de pago');
    }
  }

  /** Abre el Customer Portal de Stripe (gestión de pago, cancelación, facturas). */
  async abrirPortal(clinicId: string): Promise<void> {
    try {
      const { url } = await this.convex.action(
        api.billing.actions.createCustomerPortalSession,
        { clinicId: clinicId as never, returnTo: this.returnTo },
      );
      await this.externalBrowser.redirect(url);
    } catch (err) {
      console.error('[SubscriptionService] portal', err);
      this.toast.error('No se pudo abrir el portal de gestión');
    }
  }

  /** Cancela la suscripción al final del período actual. */
  async cancelar(clinicId: string): Promise<void> {
    try {
      await this.convex.action(api.billing.actions.cancelSubscription, {
        clinicId: clinicId as never,
        atPeriodEnd: true,
      });
      this.toast.success('La suscripción se cancelará al final del período');
    } catch (err) {
      console.error('[SubscriptionService] cancelar', err);
      this.toast.error('No se pudo cancelar la suscripción');
    }
  }

  /** Reactiva una suscripción marcada para cancelarse al final del período. */
  async reactivar(clinicId: string): Promise<void> {
    try {
      await this.convex.action(api.billing.actions.reactivateSubscription, {
        clinicId: clinicId as never,
      });
      this.toast.success('Suscripción reactivada');
    } catch (err) {
      console.error('[SubscriptionService] reactivar', err);
      this.toast.error('No se pudo reactivar la suscripción');
    }
  }

  /** Envía solicitud de contacto al equipo de ventas (caso +10 fisios). */
  async contactarVentas(
    clinicId: string,
    mensaje: string,
    telefono?: string,
  ): Promise<boolean> {
    try {
      await this.convex.action(api.billing.actions.contactarVentas, {
        clinicId: clinicId as never,
        mensaje,
        telefono,
      });
      this.toast.success('Hemos enviado tu solicitud al equipo de ventas');
      return true;
    } catch (err) {
      console.error('[SubscriptionService] contactarVentas', err);
      this.toast.error('No se pudo enviar la solicitud');
      return false;
    }
  }
}
