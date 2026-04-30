import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

import { SubscriptionService } from './subscription.service';
import { SessionService } from '../auth/services/session.service';
import {
  Ui2ButtonComponent,
  Ui2CardComponent,
} from '../../shared/ui-v2';

type BannerVariant = 'danger' | 'warning' | 'neutral';

interface BannerVm {
  variant: BannerVariant;
  icon: string;
  titulo: string;
  mensaje: string;
  ctaLabel: string;
}

const VARIANT_STYLES: Record<BannerVariant, { bg: string; fg: string; border: string }> = {
  danger: {
    bg: 'rgba(239, 68, 68, 0.10)',
    fg: 'var(--danger)',
    border: 'rgba(239, 68, 68, 0.25)',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.12)',
    fg: 'var(--warning)',
    border: 'rgba(245, 158, 11, 0.30)',
  },
  neutral: {
    bg: 'rgba(0, 0, 0, 0.04)',
    fg: 'var(--ink-700)',
    border: 'rgba(0, 0, 0, 0.08)',
  },
};

const RUTAS_OCULTAR = ['/mi-clinica/suscripcion'];

@Component({
  selector: 'app-billing-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Ui2CardComponent, Ui2ButtonComponent],
  template: `
    @if (visible(); as vm) {
      <div
        class="billing-banner"
        [style.--banner-bg]="styles()[vm.variant].bg"
        [style.--banner-fg]="styles()[vm.variant].fg"
        [style.--banner-border]="styles()[vm.variant].border"
      >
        <ui2-card [padding]="14" [radius]="18">
          <div class="billing-banner__row">
            <span
              class="material-symbols-outlined billing-banner__icon"
              aria-hidden="true"
            >{{ vm.icon }}</span>
            <div class="billing-banner__copy">
              <p class="billing-banner__title">{{ vm.titulo }}</p>
              <p class="billing-banner__message">{{ vm.mensaje }}</p>
            </div>
            <ui2-button
              variant="ghost"
              size="sm"
              iconRight="arrow_forward"
              (clicked)="abrirSuscripcion()"
            >{{ vm.ctaLabel }}</ui2-button>
          </div>
        </ui2-card>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .billing-banner {
        --banner-bg: rgba(0, 0, 0, 0.04);
        --banner-fg: var(--ink-700);
        --banner-border: rgba(0, 0, 0, 0.08);
      }
      .billing-banner ::ng-deep .ui2-card {
        background: var(--banner-bg) !important;
        border: 1px solid var(--banner-border) !important;
        box-shadow: none !important;
      }
      .billing-banner__row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .billing-banner__icon {
        color: var(--banner-fg);
        font-size: 22px;
        line-height: 1;
        flex-shrink: 0;
      }
      .billing-banner__copy {
        flex: 1 1 220px;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .billing-banner__title {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        color: var(--banner-fg);
        line-height: 1.2;
      }
      .billing-banner__message {
        margin: 0;
        font-size: 13px;
        color: var(--ink-700);
        line-height: 1.35;
      }
    `,
  ],
})
export class BillingBannerComponent {
  private readonly subs = inject(SubscriptionService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly datePipe = new DatePipe('es-ES');

  protected readonly styles = computed(() => VARIANT_STYLES);

  /** URL actual reactiva — para ocultar el banner en la propia página de suscripción. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects ?? e.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly visible = computed<BannerVm | null>(() => {
    if (!this.session.esAdmin()) return null;

    const url = this.currentUrl();
    if (RUTAS_OCULTAR.some((r) => url.startsWith(r))) return null;

    const sub = this.subs.suscripcion();
    if (!sub) return null;

    if (this.subs.bloqueada()) {
      return {
        variant: 'danger',
        icon: 'lock',
        titulo: 'Suscripción suspendida',
        mensaje: 'Actualiza el método de pago para volver a usar la app.',
        ctaLabel: 'Resolver',
      };
    }

    if (this.subs.enPeriodoGracia()) {
      const dias = this.diasHasta(sub.graceUntil);
      return {
        variant: 'warning',
        icon: 'error',
        titulo: 'Hay un problema con el pago',
        mensaje:
          dias > 0
            ? `Quedan ${dias} ${dias === 1 ? 'día' : 'días'} para resolverlo.`
            : 'Resuélvelo lo antes posible para evitar la suspensión.',
        ctaLabel: 'Resolver',
      };
    }

    if (this.subs.enTrial() && this.subs.diasRestantesTrial() <= 5) {
      const dias = this.subs.diasRestantesTrial();
      return {
        variant: 'warning',
        icon: 'schedule',
        titulo:
          dias > 0
            ? `Tu trial termina en ${dias} ${dias === 1 ? 'día' : 'días'}`
            : 'Tu trial termina hoy',
        mensaje: 'Añade un método de pago para no interrumpir el servicio.',
        ctaLabel: 'Añadir pago',
      };
    }

    if (this.subs.cancelaAlFinDelPeriodo() && sub.currentPeriodEnd) {
      const fecha = this.datePipe.transform(sub.currentPeriodEnd, 'dd/MM/yyyy');
      return {
        variant: 'neutral',
        icon: 'event_busy',
        titulo: 'Cancelación programada',
        mensaje: `La suscripción se cancelará el ${fecha}.`,
        ctaLabel: 'Reactivar',
      };
    }

    return null;
  });

  protected abrirSuscripcion(): void {
    void this.router.navigate(['/mi-clinica/suscripcion']);
  }

  private diasHasta(timestamp: number | undefined): number {
    if (!timestamp) return 0;
    const ms = timestamp - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }
}
