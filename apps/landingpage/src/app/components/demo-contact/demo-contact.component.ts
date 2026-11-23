import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';
import { LeadFormComponent } from '../lead-form/lead-form.component';
import { DEMO_CALENDAR_URL, PLAZO_RESPUESTA } from '../../shared/site-config';

/**
 * Cierre comercial de la home: demo de 15 min (`#demo`) + «Te llamamos»
 * (`#contacto`).
 *
 * El calendario de Google NO se carga hasta que la persona pulsa el botón:
 * así no se descargan scripts ni cookies de Google para quien no lo usa, y no
 * penaliza la carga de la página.
 */
@Component({
  selector: 'web-demo-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ScrollAnimateDirective, LeadFormComponent],
  template: `
    <section class="demo" id="demo">
      <div class="wrap">
        <div class="head scroll-reveal" webScrollAnimate>
          <span class="eyebrow">Pide una demo</span>
          <h2 class="font-display">Hablemos de<br />tu clínica</h2>
          <p>
            Te enseñamos Kengo con tus casos en 15 minutos, o te llamamos
            nosotros. Respondemos en {{ plazo }}.
          </p>
        </div>

        <div class="cols">
          <div class="card card-demo">
            @if (calendarioCargado() && calendarUrl) {
              <iframe
                class="cal"
                [src]="calendarUrl"
                title="Calendario para reservar una demo de Kengo"
                loading="lazy"
              ></iframe>
            } @else {
              <h3>Agenda una demo de 15 min</h3>
              <p class="sub">Te atienden Guille o Pablo, del equipo de Kengo.</p>
              <ul class="ticks">
                <li>Cómo montar un plan con vídeo en menos de 2 minutos</li>
                <li>Qué ve tu paciente en casa y cómo te avisa si se descuelga</li>
                <li>Tu marca en la app y la gestión de todo el equipo</li>
                <li>Precio para tu clínica y la oferta fundadora</li>
              </ul>
              @if (calendarUrl) {
                <button type="button" class="btn btn-primary" (click)="calendarioCargado.set(true)">
                  Elegir día y hora
                  <svg fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
                <p class="note">Se abrirá el calendario de reservas de Google.</p>
              } @else {
                <p class="note">Déjanos tus datos y te proponemos un hueco.</p>
              }
            }
          </div>

          <div class="card card-form" id="contacto">
            <h3>Te llamamos</h3>
            <p class="sub">Déjanos tus datos y te contactamos en {{ plazo }}.</p>
            <web-lead-form />
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .demo {
        padding: 112px 0;
        background: linear-gradient(150deg, #ffe7d2, #ffdcc4 55%, #ffd0b2);
      }

      .demo .eyebrow {
        color: #8f3d21;
      }
      .demo .eyebrow::before {
        background: #8f3d21;
      }

      .demo .head h2 {
        color: var(--color-primary-dark);
      }

      .demo .head p {
        color: var(--color-ink-strong);
      }

      .cols {
        display: grid;
        grid-template-columns: 0.9fr 1.1fr;
        gap: 22px;
        margin-top: 48px;
        align-items: start;
      }

      .card {
        background: #fff;
        border-radius: 28px;
        padding: 32px;
        box-shadow: 0 18px 48px rgba(150, 100, 70, 0.12);
        scroll-margin-top: 6rem;
      }

      .card h3 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        color: var(--color-ink-strong);
      }

      .sub {
        margin: 8px 0 22px;
        font-size: 15px;
        line-height: 1.55;
        color: var(--color-ink-700);
      }

      .card-demo .ticks {
        margin: 0 0 26px;
      }

      .card-demo .ticks li {
        color: var(--color-ink-strong);
      }

      .note {
        margin: 12px 0 0;
        font-size: 13px;
        color: var(--color-ink-700);
      }

      .cal {
        display: block;
        width: 100%;
        height: 640px;
        border: 0;
        border-radius: 16px;
      }

      .card-demo:has(.cal) {
        padding: 12px;
      }

      @media (max-width: 1080px) {
        .cols {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .demo {
          padding: 76px 0;
        }
        .cols {
          margin-top: 36px;
        }
        .card {
          padding: 24px 20px;
          border-radius: 22px;
        }
      }
    `,
  ],
})
export class DemoContactComponent {
  protected readonly plazo = PLAZO_RESPUESTA;
  protected readonly calendarioCargado = signal(false);

  /**
   * URL constante de configuración (no viene del usuario), por eso es seguro
   * marcarla como de confianza para el `src` del iframe.
   */
  protected readonly calendarUrl: SafeResourceUrl | null = DEMO_CALENDAR_URL
    ? inject(DomSanitizer).bypassSecurityTrustResourceUrl(DEMO_CALENDAR_URL)
    : null;
}
