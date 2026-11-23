import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';
import { FAQS, faqJsonLd } from '../../shared/faq';

const JSON_LD_ID = 'faq-jsonld';

/**
 * Preguntas frecuentes con `<details>` nativo: accesible por teclado y
 * funcional aunque la sección aún no se haya hidratado.
 *
 * El JSON-LD `FAQPage` se inyecta en el `<head>` solo durante el prerender:
 * el navegador ya lo recibe en el HTML estático y no hace falta repetirlo al
 * hidratar.
 */
@Component({
  selector: 'web-faq',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ScrollAnimateDirective, RouterLink],
  template: `
    <section class="faq" id="faq">
      <div class="wrap faq-in">
        <div class="head scroll-reveal" webScrollAnimate>
          <span class="eyebrow">Preguntas frecuentes</span>
          <h2 class="font-display">Lo que nos<br />preguntan las clínicas</h2>
          <p>
            ¿Te queda alguna duda?
            <a routerLink="/" fragment="contacto">Escríbenos</a> y te
            respondemos.
          </p>
        </div>
        <div class="list">
          @for (f of faqs; track f.pregunta) {
            <details>
              <summary>{{ f.pregunta }}</summary>
              <p>{{ f.respuesta }}</p>
            </details>
          }
          <p class="legal">
            Más detalle en la
            <a routerLink="/legal/privacidad">política de privacidad</a> y en los
            <a routerLink="/legal/terminos">términos</a>.
          </p>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .faq {
        padding: 112px 0;
        background: var(--color-cream);
      }

      .faq-in {
        display: grid;
        grid-template-columns: 0.8fr 1.2fr;
        gap: 56px;
        align-items: start;
      }

      .head a,
      .legal a {
        color: var(--color-primary-dark);
        font-weight: 700;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      details {
        background: #fff;
        border: 1px solid var(--color-ink-200);
        border-radius: 20px;
        padding: 0 22px;
      }

      details[open] {
        box-shadow: 0 10px 28px rgba(150, 100, 70, 0.08);
      }

      summary {
        list-style: none;
        cursor: pointer;
        padding: 20px 28px 20px 0;
        position: relative;
        font-size: 16.5px;
        font-weight: 700;
        color: var(--color-ink-strong);
      }

      summary::-webkit-details-marker {
        display: none;
      }

      summary::after {
        content: '+';
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        font-size: 24px;
        font-weight: 400;
        color: var(--color-primary);
        transition: transform 0.2s;
      }

      details[open] summary::after {
        transform: translateY(-50%) rotate(45deg);
      }

      summary:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 4px;
        border-radius: 8px;
      }

      details p {
        margin: 0;
        padding: 0 0 20px;
        font-size: 15.5px;
        line-height: 1.65;
        color: var(--color-ink-strong);
      }

      .legal {
        margin: 8px 0 0;
        font-size: 14px;
        color: var(--color-ink-700);
      }

      @media (max-width: 1080px) {
        .faq-in {
          grid-template-columns: 1fr;
          gap: 36px;
        }
      }

      @media (max-width: 640px) {
        .faq {
          padding: 76px 0;
        }
        details {
          padding: 0 18px;
        }
      }
    `,
  ],
})
export class FaqComponent {
  protected readonly faqs = FAQS;

  constructor() {
    if (!isPlatformServer(inject(PLATFORM_ID))) return;
    const document = inject(DOCUMENT);
    if (document.getElementById(JSON_LD_ID)) return;
    const script = document.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(faqJsonLd());
    document.head.appendChild(script);
  }
}
