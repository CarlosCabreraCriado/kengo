import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { ConvexService } from '../convex/convex.service';
import { SessionService } from '../auth/services/session.service';
import { ClinicaActivaService } from '../auth/services/clinica-activa.service';
import { ExternalBrowserService } from '../services/external-browser.service';
import { PlatformService } from '../services/platform.service';
import { LoggerService } from '../services/logger.service';
import { ToastService } from '../../shared/services/toast/toast.service';
import { api } from '../../../../../../convex/_generated/api';
import type { ClinicSubscription } from '@kengo/shared-models';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Estado reactivo de la suscripción de la clínica activa.
 *
 * Resuelve la suscripción de la **clínica activa** (`ClinicaActivaService`)
 * para cualquier miembro facturable (`fisio` o `admin`). Esto permite que los
 * fisios no-admin también vean el estado de bloqueo en la UI: la regla
 * multiclínica dice que la clínica activa manda, así que cualquiera que
 * trabaje en ella necesita conocer su estado. Las acciones que mutan billing
 * (Checkout, Portal, cancel/reactivar) siguen restringidas al owner — el
 * payload incluye `esOwner` para esa decisión.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly convex = inject(ConvexService);
  private readonly session = inject(SessionService);
  private readonly clinicaActiva = inject(ClinicaActivaService);
  private readonly toast = inject(ToastService);
  private readonly externalBrowser = inject(ExternalBrowserService);
  private readonly platform = inject(PlatformService);
  private readonly logger = inject(LoggerService);

  private get returnTo(): 'native' | 'web' {
    return this.platform.isNative() ? 'native' : 'web';
  }

  /**
   * ID de la clínica activa cuando el usuario es miembro facturable
   * (`fisio` o `admin`). `null` en cualquier otro caso (sin clínica activa,
   * o solo paciente en ella).
   */
  public readonly clinicIdActiva = computed<string | null>(() => {
    const id = this.clinicaActiva.selectedClinicaId();
    if (!id) return null;
    const m = this.session.misclinicas().find((c) => c.clinicId === id);
    return m?.puesto === 'admin' || m?.puesto === 'fisio' ? id : null;
  });

  /**
   * `true` cuando el usuario es admin en la clínica activa. Úsalo en las CTAs
   * que mutan billing/team (Stripe Checkout, Portal, transferOwnership).
   */
  public readonly esAdminEnClinicaActiva = computed<boolean>(() => {
    const id = this.clinicaActiva.selectedClinicaId();
    if (!id) return false;
    const m = this.session.misclinicas().find((c) => c.clinicId === id);
    return m?.puesto === 'admin';
  });

  private readonly query = this.convex.watchQuery(
    api.billing.queries.getMyClinicSubscription,
    () => {
      const id = this.clinicIdActiva();
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

  /**
   * Días de CALENDARIO restantes de trial en la zona horaria local (B-1). Se
   * comparan medianoches locales, no ventanas de 24 h: si el trial acaba hoy a
   * las 23:00, muestra 0 ("hoy"), no 1. `0` = termina hoy o ya venció.
   */
  public readonly diasRestantesTrial = computed<number>(() => {
    const sub = this.suscripcion();
    if (!sub?.trialEnd) return 0;
    const fin = new Date(sub.trialEnd);
    const ahora = new Date();
    const finMedianoche = new Date(
      fin.getFullYear(),
      fin.getMonth(),
      fin.getDate(),
    ).getTime();
    const hoyMedianoche = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
    ).getTime();
    return Math.max(0, Math.round((finMedianoche - hoyMedianoche) / DIA_MS));
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

  /**
   * `true` si el usuario autenticado es el propietario de la clínica activa.
   * Solo el owner puede ejecutar acciones de billing (Checkout, Portal,
   * cancelar, reactivar, ver facturas). Los demás admins ven la pantalla
   * en modo read-only.
   */
  public readonly esOwnerDeClinicaActiva = computed<boolean>(
    () => this.suscripcion()?.esOwner === true,
  );

  /** Nombre del owner (para el mensaje "El responsable es {nombre}"). */
  public readonly ownerNombre = computed<string | null>(
    () => this.suscripcion()?.ownerNombre ?? null,
  );

  /** Nombre de la clínica activa, leído del payload de billing. */
  public readonly clinicaNombre = computed<string>(
    () => this.suscripcion()?.clinicaNombre ?? '',
  );

  /**
   * Veredicto de bloqueo calculado en el servidor (espejo de
   * `billingPermiteOperar`): cubre unpaid/canceled/incomplete y past_due con
   * gracia agotada, sin la ambigüedad del `none` (sin fila = permisivo). Se
   * lee directo del payload en vez de rederivarlo en el cliente.
   */
  public readonly bloqueada = computed(
    () => this.suscripcion()?.bloqueada === true,
  );

  public readonly cancelaAlFinDelPeriodo = computed(
    () => this.suscripcion()?.cancelAtPeriodEnd === true,
  );

  /**
   * `true` mientras una acción de billing (checkout/portal/cancelar/reactivar)
   * está en vuelo. Evita el doble click que crearía dos Checkout sessions o
   * dos actions concurrentes (H-10). Se cablea a `[loading]`/`[disabled]` de
   * los CTAs.
   */
  private readonly _accionEnCurso = signal(false);
  public readonly accionEnCurso = this._accionEnCurso.asReadonly();

  /** Inicia Checkout de Stripe y redirige al usuario. */
  async iniciarCheckout(clinicId: string): Promise<void> {
    if (this._accionEnCurso()) return;
    this._accionEnCurso.set(true);
    try {
      const { url } = await this.convex.action(
        api.billing.actions.createCheckoutSession,
        { clinicId: clinicId as never, returnTo: this.returnTo },
      );
      await this.externalBrowser.redirect(url);
    } catch (err) {
      this.logger.error('[SubscriptionService] checkout', err);
      this.toast.error('No se pudo iniciar el proceso de pago');
    } finally {
      this._accionEnCurso.set(false);
    }
  }

  /** Abre el Customer Portal de Stripe (gestión de pago, cancelación, facturas). */
  async abrirPortal(clinicId: string): Promise<void> {
    if (this._accionEnCurso()) return;
    this._accionEnCurso.set(true);
    try {
      const { url } = await this.convex.action(
        api.billing.actions.createCustomerPortalSession,
        { clinicId: clinicId as never, returnTo: this.returnTo },
      );
      await this.externalBrowser.redirect(url);
    } catch (err) {
      this.logger.error('[SubscriptionService] portal', err);
      this.toast.error('No se pudo abrir el portal de gestión');
    } finally {
      this._accionEnCurso.set(false);
    }
  }

  /** Cancela la suscripción al final del período actual. */
  async cancelar(clinicId: string): Promise<void> {
    if (this._accionEnCurso()) return;
    this._accionEnCurso.set(true);
    try {
      await this.convex.action(api.billing.actions.cancelSubscription, {
        clinicId: clinicId as never,
        atPeriodEnd: true,
      });
      this.toast.success('La suscripción se cancelará al final del período');
    } catch (err) {
      this.logger.error('[SubscriptionService] cancelar', err);
      this.toast.error('No se pudo cancelar la suscripción');
    } finally {
      this._accionEnCurso.set(false);
    }
  }

  /** Reactiva una suscripción marcada para cancelarse al final del período. */
  async reactivar(clinicId: string): Promise<void> {
    if (this._accionEnCurso()) return;
    this._accionEnCurso.set(true);
    try {
      await this.convex.action(api.billing.actions.reactivateSubscription, {
        clinicId: clinicId as never,
      });
      this.toast.success('Suscripción reactivada');
    } catch (err) {
      this.logger.error('[SubscriptionService] reactivar', err);
      this.toast.error('No se pudo reactivar la suscripción');
    } finally {
      this._accionEnCurso.set(false);
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
      this.logger.error('[SubscriptionService] contactarVentas', err);
      this.toast.error('No se pudo enviar la solicitud');
      return false;
    }
  }
}
