import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

@Component({
  selector: 'web-cta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ScrollAnimateDirective],
  template: `
    <section class="cta">
      <div class="wrap cta-in">
        <div class="cta-copy scroll-reveal" webScrollAnimate>
          <span class="eyebrow">Empieza hoy</span>
          <h2 class="font-display">
            Que el plan salga<br />de la consulta<br />contigo
          </h2>
          <p>
            Crea tu clínica, invita a tu primer paciente con un código y
            asígnale un plan en la misma tarde.
          </p>
          <div class="cta-btns">
            <a href="https://kengoapp.com/login" class="btn btn-primary">
              Crear cuenta gratuita
              <svg
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
            <a href="#como" class="btn btn-ghost">Ver cómo funciona</a>
          </div>
        </div>
        <div class="mock-wrap">
          <picture>
            <source
              type="image/avif"
              srcset="
                assets/shots/icono-app-640w.avif   640w,
                assets/shots/icono-app-960w.avif   960w,
                assets/shots/icono-app-1280w.avif 1280w
              "
              sizes="(max-width: 440px) 92vw, 400px"
            />
            <source
              type="image/webp"
              srcset="
                assets/shots/icono-app-640w.webp   640w,
                assets/shots/icono-app-960w.webp   960w,
                assets/shots/icono-app-1280w.webp 1280w
              "
              sizes="(max-width: 440px) 92vw, 400px"
            />
            <img
              class="mock mock-xs"
              src="assets/shots/icono-app-960w.png"
              width="1500"
              height="1714"
              alt="Kengo en la pantalla de inicio del iPhone"
              loading="lazy"
            />
          </picture>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .cta {
        position: relative;
        overflow: hidden;
        background: linear-gradient(150deg, #ffe7d2, #ffdcc4 55%, #ffd0b2);
      }

      .cta-in {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        align-items: end;
        gap: 20px;
      }

      .cta-copy {
        padding: 104px 0;
      }

      .cta h2 {
        font-size: clamp(34px, 4vw, 58px);
        color: var(--color-primary-dark);
        margin: 20px 0 0;
      }

      .cta p {
        color: var(--color-ink-700);
        font-size: 18px;
        line-height: 1.65;
        margin: 20px 0 0;
        max-width: 26em;
      }

      .cta .eyebrow {
        color: #8f3d21;
      }
      .cta .eyebrow::before {
        background: #8f3d21;
      }

      .cta-btns {
        display: flex;
        gap: 14px;
        margin-top: 34px;
        flex-wrap: wrap;
      }

      .cta .mock-wrap {
        align-self: end;
        justify-content: flex-end;
        margin-right: calc(-1 * var(--bleed));
      }

      .cta .mock {
        margin: 0 0 -1px auto;
        max-width: 400px;
      }

      @media (max-width: 1080px) {
        .cta-in {
          grid-template-columns: 1fr;
          gap: 44px;
        }
        .cta-copy {
          padding: 80px 0 0;
        }
      }

      @media (max-width: 640px) {
        .cta-copy {
          padding: 64px 0 0;
        }
        .cta-in {
          gap: 36px;
        }
      }
    `,
  ],
})
export class CtaComponent {}
