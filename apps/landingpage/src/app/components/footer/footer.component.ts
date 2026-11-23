import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';
import { CONTACT_EMAIL, SOCIAL } from '../../shared/site-config';

@Component({
  selector: 'web-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ScrollAnimateDirective, RouterLink],
  template: `
    <footer>
      <div class="wrap">
        <div class="foot-top scroll-reveal" webScrollAnimate>
          <div class="foot-brand">
            <a routerLink="/" aria-label="Kengo — inicio">
              <img src="logo-kengo-horizontal.svg" alt="Kengo" />
            </a>
            <p>
              La plataforma que mantiene el tratamiento vivo entre sesión y
              sesión.
            </p>
            <a class="mail" [href]="'mailto:' + contactEmail">{{ contactEmail }}</a>
            @if (social.instagram || social.linkedin) {
              <div class="social">
                @if (social.instagram) {
                  <a [href]="social.instagram" target="_blank" rel="noopener" aria-label="Kengo en Instagram">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                    </svg>
                  </a>
                }
                @if (social.linkedin) {
                  <a [href]="social.linkedin" target="_blank" rel="noopener" aria-label="Kengo en LinkedIn">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.83v1.54h.06c.53-1.01 1.84-2.07 3.79-2.07 4.05 0 4.8 2.67 4.8 6.13V21h-4v-4.98c0-1.19-.02-2.72-1.66-2.72-1.66 0-1.92 1.3-1.92 2.63V21h-4V9.75Z" />
                    </svg>
                  </a>
                }
              </div>
            }
          </div>
          <div class="foot-cols">
            <div class="foot-col">
              <h5>Producto</h5>
              <!-- routerLink + fragment en vez de href="#...": desde una
                   página legal el ancla suelta no lleva a ninguna parte. -->
              <a routerLink="/" fragment="fisios">Para fisios</a>
              <a routerLink="/" fragment="clinicas">Para clínicas</a>
              <a routerLink="/" fragment="precios">Precios</a>
              <a routerLink="/" fragment="faq">Preguntas frecuentes</a>
            </div>
            <div class="foot-col">
              <h5>Empresa</h5>
              <a routerLink="/" fragment="equipo">Sobre Kengo</a>
              <a routerLink="/" fragment="demo">Pide una demo</a>
              <a routerLink="/" fragment="contacto">Contacto</a>
              <a routerLink="/soporte">Soporte</a>
            </div>
            <div class="foot-col">
              <h5>Legal</h5>
              <a routerLink="/legal/privacidad">Privacidad</a>
              <a routerLink="/legal/terminos">Términos</a>
              <a routerLink="/legal/cookies">Cookies</a>
              <a routerLink="/legal/aviso-legal">Aviso legal</a>
              <a routerLink="/eliminar-cuenta">Eliminar cuenta</a>
            </div>
          </div>
        </div>
        <div class="foot-bot">
          <span>&copy; {{ currentYear }} Kengo. Todos los derechos reservados.</span>
          <span>Hecho en Canarias</span>
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      footer {
        background: var(--color-cream);
        border-top: 1px solid var(--color-ink-200);
        color: var(--color-ink-700);
        padding: 64px 0 40px;
        font-size: 14px;
      }

      .foot-top {
        display: flex;
        justify-content: space-between;
        gap: 40px;
        flex-wrap: wrap;
        padding-bottom: 40px;
        border-bottom: 1px solid var(--color-ink-200);
      }

      .foot-brand {
        max-width: 280px;
      }

      .foot-brand img {
        height: 32px;
      }

      .foot-brand p {
        margin: 18px 0 0;
        font-size: 14px;
        line-height: 1.6;
      }

      .foot-cols {
        display: flex;
        gap: 72px;
        flex-wrap: wrap;
      }

      .foot-col h5 {
        margin: 0 0 14px;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #a34a2c;
        font-weight: 700;
      }

      .foot-col a {
        display: block;
        color: var(--color-ink-700);
        margin-bottom: 9px;
        text-decoration: none;
      }

      .foot-col a:hover {
        color: var(--color-primary);
      }

      .foot-bot {
        padding-top: 26px;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        font-size: 13px;
        color: #7d6b62;
      }

      .mail {
        display: inline-block;
        margin-top: 14px;
        color: var(--color-primary-dark);
        font-weight: 700;
        text-decoration: none;
      }

      .social {
        display: flex;
        gap: 10px;
        margin-top: 16px;
      }

      .social a {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        border: 1px solid var(--color-ink-200);
        color: var(--color-ink-strong);
        background: #fff;
      }

      .social a:hover {
        color: var(--color-primary);
        border-color: var(--color-primary);
      }

      .social svg {
        width: 18px;
        height: 18px;
      }
    `,
  ],
})
export class FooterComponent {
  protected readonly currentYear = new Date().getFullYear();
  protected readonly contactEmail = CONTACT_EMAIL;
  protected readonly social = SOCIAL;
}
