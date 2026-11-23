import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';
import { environment } from '../../../environments/environment';
import {
  OFERTA_FUNDADORA,
  PLANES_WEB,
  PlanWeb,
  TRIAL_DIAS,
} from '../../shared/site-config';

const eurEntero = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const eurDecimal = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Precios públicos. Los importes salen de `PLANES_WEB`, atado por test a la
 * tabla real de Convex/Stripe: no escribir cifras a mano en el template.
 */
@Component({
  selector: 'web-pricing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ScrollAnimateDirective, RouterLink],
  template: `
    <section class="pricing" id="precios">
      <div class="wrap">
        <div class="head scroll-reveal" webScrollAnimate>
          <span class="eyebrow">Precios</span>
          <h2 class="font-display">Un precio por clínica,<br />sin sorpresas</h2>
          <p>
            Pagas según el número de fisios, no por paciente. {{ trialDias }} días
            gratis sin tarjeta y sin permanencia: si no te convence, lo dejas.
          </p>
        </div>

        @if (ofertaActiva) {
          <div class="founder scroll-reveal" webScrollAnimate>
            <span class="founder-tag">Oferta fundadora</span>
            <p>
              <b>-{{ oferta.descuentoPct }} % durante {{ oferta.meses }} meses</b>
              para las primeras {{ oferta.plazasTotales }} clínicas.
              <span class="left">Quedan {{ oferta.plazasRestantes }} de {{ oferta.plazasTotales }} plazas.</span>
            </p>
            <a routerLink="/" fragment="demo" class="btn btn-light">Reservar mi plaza</a>
          </div>
        }

        <div class="grid scroll-reveal" webScrollAnimate>
          @for (plan of planes; track plan.nombre) {
            <article class="plan" [class.featured]="plan.destacado">
              @if (plan.destacado) {
                <span class="badge">Recomendada para equipos</span>
              }
              <h3>{{ plan.nombre }}</h3>
              <p class="who">{{ rangoFisios(plan) }}</p>
              <p class="price">
                <b>{{ formato(plan.precioEur) }}</b><span>/mes</span>
              </p>
              @if (ofertaActiva) {
                <p class="promo">
                  {{ formato(conDescuento(plan.precioEur)) }}/mes los {{ oferta.meses }} primeros meses
                </p>
              }
              <ul class="ticks">
                <li>Hasta {{ plan.limitePacientes }} pacientes activos</li>
                <li>Catálogo de +500 ejercicios en vídeo</li>
                <li>Seguimiento, alertas y chat con el paciente</li>
                <li>Tu logo y tus colores en la app</li>
              </ul>
              <p class="unl">
                ¿Más pacientes? Ilimitados por {{ formato(plan.precioIlimitadoEur) }}/mes.
              </p>
              <a
                [href]="registroUrl"
                class="btn"
                [class.btn-primary]="plan.destacado"
                [class.btn-ghost]="!plan.destacado"
              >
                Empieza gratis
              </a>
            </article>
          }
          <article class="plan plan-xl">
            <h3>+9 fisios</h3>
            <p class="who">Grupos y cadenas de clínicas</p>
            <p class="price"><b>A medida</b></p>
            <ul class="ticks">
              <li>Plazas de fisio según tu equipo</li>
              <li>Varias sedes bajo una misma cuenta</li>
              <li>Acompañamiento en la puesta en marcha</li>
            </ul>
            <a routerLink="/" fragment="demo" class="btn btn-ghost">Hablemos</a>
          </article>
        </div>

        <div class="roi scroll-reveal" webScrollAnimate>
          <b class="font-display">Sube 1 € por sesión y Kengo te sale gratis</b>
          <p>
            Con {{ planes[0].precioEur }} sesiones al mes ya cubres el plan
            {{ planes[0].nombre }}. Y tu paciente se lleva algo que antes no
            tenía: su plan en el móvil y una línea directa contigo.
          </p>
        </div>

        <p class="fine">
          Precios mensuales por clínica, impuestos no incluidos. Sin permanencia:
          cancelas cuando quieras desde la propia app.
        </p>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .pricing {
        padding: 112px 0;
        background: var(--color-sand);
      }

      .pricing .head p {
        color: var(--color-ink-strong);
      }

      .founder {
        display: flex;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
        margin-top: 40px;
        padding: 18px 22px;
        border-radius: 22px;
        background: var(--color-primary-dark);
        color: #fff;
      }

      .founder p {
        flex: 1;
        min-width: 220px;
        margin: 0;
        font-size: 15.5px;
        line-height: 1.5;
      }

      .founder .left {
        display: inline-block;
        margin-left: 4px;
        font-weight: 700;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .founder-tag {
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.18);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 18px;
        margin-top: 28px;
        align-items: stretch;
      }

      .plan {
        position: relative;
        display: flex;
        flex-direction: column;
        background: #fff;
        border: 1px solid var(--color-ink-200);
        border-radius: 26px;
        padding: 28px 24px;
      }

      .plan.featured {
        border: 2px solid var(--color-primary);
        box-shadow: 0 18px 44px rgba(224, 112, 79, 0.18);
      }

      .plan-xl {
        background: transparent;
        border-style: dashed;
      }

      .badge {
        position: absolute;
        top: -13px;
        left: 24px;
        padding: 5px 12px;
        border-radius: 999px;
        background: var(--color-primary-dark);
        color: #fff;
        font-size: 12px;
        font-weight: 700;
      }

      h3 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        color: var(--color-ink-strong);
      }

      .who {
        margin: 4px 0 0;
        font-size: 14px;
        color: var(--color-ink-700);
      }

      .price {
        margin: 18px 0 0;
        color: var(--color-ink-strong);
      }

      .price b {
        font-size: 40px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .price span {
        margin-left: 4px;
        font-size: 15px;
        color: var(--color-ink-700);
      }

      .promo {
        margin: 6px 0 0;
        font-size: 13px;
        font-weight: 700;
        color: var(--color-primary-dark);
      }

      .plan .ticks {
        margin: 20px 0 0;
        gap: 9px;
      }

      .plan .ticks li {
        font-size: 14px;
        color: var(--color-ink-strong);
      }

      .unl {
        margin: 16px 0 0;
        font-size: 13px;
        color: var(--color-ink-700);
      }

      .plan .btn {
        margin-top: auto;
        justify-content: center;
      }

      .plan .ticks + .btn,
      .unl + .btn {
        margin-top: 22px;
      }

      .plan-xl .ticks {
        margin-bottom: 22px;
      }

      .roi {
        margin-top: 28px;
        padding: 26px 28px;
        border-radius: 24px;
        background: #fff;
        border: 1px solid var(--color-ink-200);
      }

      .roi b {
        display: block;
        font-size: clamp(22px, 2.4vw, 30px);
        color: var(--color-primary-dark);
      }

      .roi p {
        margin: 10px 0 0;
        font-size: 16px;
        line-height: 1.6;
        color: var(--color-ink-strong);
        max-width: 46em;
      }

      .fine {
        margin: 18px 0 0;
        font-size: 13px;
        color: var(--color-ink-700);
      }

      @media (max-width: 1080px) {
        .grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 640px) {
        .pricing {
          padding: 76px 0;
        }
        .grid {
          grid-template-columns: 1fr;
          gap: 22px;
        }
        .founder {
          flex-direction: column;
          align-items: flex-start;
        }
        .founder .btn {
          width: 100%;
          justify-content: center;
          box-sizing: border-box;
        }
      }
    `,
  ],
})
export class PricingComponent {
  protected readonly planes = PLANES_WEB;
  protected readonly oferta = OFERTA_FUNDADORA;
  protected readonly ofertaActiva = OFERTA_FUNDADORA.plazasRestantes > 0;
  protected readonly trialDias = TRIAL_DIAS;
  protected readonly registroUrl = `${environment.appUrl}/registro`;

  /** «89 €» si es entero; «62,30 €» si lleva céntimos. */
  protected formato(n: number): string {
    return Number.isInteger(n) ? eurEntero.format(n) : eurDecimal.format(n);
  }

  protected conDescuento(n: number): number {
    return Math.round(n * (100 - OFERTA_FUNDADORA.descuentoPct)) / 100;
  }

  protected rangoFisios(plan: PlanWeb): string {
    return plan.fisiosMin === plan.fisiosMax
      ? plan.fisiosMin === 1
        ? '1 fisio'
        : `${plan.fisiosMin} fisios`
      : `De ${plan.fisiosMin} a ${plan.fisiosMax} fisios`;
  }
}
