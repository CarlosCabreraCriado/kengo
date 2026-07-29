import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { ContactFormComponent } from '../../components/contact-form/contact-form.component';
import { applySeo } from '../../shared/seo';

const CANONICAL = 'https://www.kengoapp.com/soporte';

/**
 * Página pública de soporte.
 *
 * Es la **Support URL** que se declara en App Store Connect y en Play
 * Console, así que debe resolver a contenido real sin iniciar sesión y sin
 * instalar la app. No confundir con la ruta `/soporte` de la aplicación, que
 * es la pantalla interna de impersonación protegida por `SoporteGuard`.
 */
@Component({
  selector: 'web-soporte-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [HeaderComponent, FooterComponent, ContactFormComponent, RouterLink],
  template: `
    <web-header />

    <main class="soporte-main">
      <div class="soporte-wrap">
        <header class="soporte-head">
          <p class="soporte-overline">Soporte</p>
          <h1>¿En qué podemos ayudarte?</h1>
          <p class="soporte-sub">
            Escríbenos y te responderemos lo antes posible. Si eres paciente y
            tienes dudas sobre tu tratamiento, consulta primero con tu
            fisioterapeuta.
          </p>
        </header>

        <div class="soporte-grid">
          <section class="soporte-col">
            <h2>Preguntas frecuentes</h2>

            <details class="faq">
              <summary>Soy paciente, ¿cómo empiezo a usar Kengo?</summary>
              <p>
                Necesitas un código de invitación de tu fisioterapeuta. Con él
                podrás crear tu cuenta y ver el plan que te haya asignado.
              </p>
            </details>

            <details class="faq">
              <summary>He olvidado mi contraseña</summary>
              <p>
                En la pantalla de inicio de sesión pulsa “He olvidado mi
                contraseña” y te enviaremos un enlace para restablecerla.
              </p>
            </details>

            <details class="faq">
              <summary>¿Cómo gestiono la suscripción de mi clínica?</summary>
              <p>
                Desde la aplicación, en Mi clínica → Suscripción. Allí puedes
                iniciar, cambiar o cancelar el plan. La cancelación surte
                efecto al final del periodo ya abonado.
              </p>
            </details>

            <details class="faq">
              <summary>¿Cómo elimino mi cuenta y mis datos?</summary>
              <p>
                Puedes hacerlo desde la aplicación, en Perfil → Eliminar
                cuenta. También puedes solicitarlo desde
                <a routerLink="/eliminar-cuenta">esta página</a> si ya no
                tienes acceso a la app.
              </p>
            </details>

            <details class="faq">
              <summary>¿Kengo sustituye a mi fisioterapeuta?</summary>
              <p>
                No. Kengo es una herramienta de apoyo entre consultas: no
                diagnostica ni sustituye el criterio de un profesional. Ante
                dolor agudo o empeoramiento, interrumpe los ejercicios y
                contacta con tu fisioterapeuta.
              </p>
            </details>
          </section>

          <section class="soporte-col">
            <h2>Contacto directo</h2>
            <ul class="soporte-contact">
              <li>
                <span>Correo</span>
                <a href="mailto:info&#64;kengoapp.com">info&#64;kengoapp.com</a>
              </li>
              <li>
                <span>Teléfono</span>
                <a href="tel:+34634909756">+34 634 90 97 56</a>
              </li>
              <li>
                <span>Dirección</span>
                <p>
                  KENGO SC<br />
                  Calle Quevedo 10 P02 A DCHA<br />
                  38005 Santa Cruz de Tenerife (España)
                </p>
              </li>
            </ul>

            <h2 class="soporte-form-title">Escríbenos</h2>
            <web-contact-form
              idPrefix="soporte"
              submitLabel="Enviar consulta"
              asuntoPlaceholder="¿Sobre qué necesitas ayuda?"
            />
          </section>
        </div>
      </div>
    </main>

    <web-footer />
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .soporte-main {
        background: var(--color-cream);
        padding: 132px 0 72px;
      }

      .soporte-wrap {
        max-width: 1040px;
        margin: 0 auto;
        padding: 0 20px;
      }

      .soporte-head {
        padding-bottom: 24px;
        margin-bottom: 32px;
        border-bottom: 1px solid var(--color-ink-200);
      }

      .soporte-overline {
        margin: 0 0 10px;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #a34a2c;
        font-weight: 700;
      }

      .soporte-head h1 {
        margin: 0;
        font-size: clamp(30px, 5vw, 42px);
        line-height: 1.1;
        color: var(--color-ink);
        letter-spacing: -0.02em;
      }

      .soporte-sub {
        margin: 14px 0 0;
        font-size: 16px;
        line-height: 1.6;
        color: var(--color-ink-700);
        max-width: 62ch;
      }

      .soporte-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 48px;
        align-items: start;
      }

      .soporte-col h2 {
        margin: 0 0 18px;
        font-size: 20px;
        color: var(--color-ink);
      }

      .soporte-form-title {
        margin-top: 36px;
      }

      .faq {
        border-bottom: 1px solid var(--color-ink-200);
        padding: 14px 0;
      }

      .faq summary {
        cursor: pointer;
        font-weight: 600;
        color: var(--color-ink);
        font-size: 15px;
        list-style: none;
      }

      .faq summary::-webkit-details-marker {
        display: none;
      }

      .faq summary::after {
        content: '+';
        float: right;
        color: var(--color-primary);
        font-weight: 700;
      }

      .faq[open] summary::after {
        content: '–';
      }

      .faq p {
        margin: 10px 0 0;
        font-size: 14px;
        line-height: 1.6;
        color: var(--color-ink-700);
      }

      .soporte-contact {
        list-style: none;
        margin: 0 0 8px;
        padding: 0;
      }

      .soporte-contact li {
        padding: 12px 0;
        border-bottom: 1px solid var(--color-ink-200);
        font-size: 14px;
        color: var(--color-ink-700);
      }

      .soporte-contact span {
        display: block;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--color-ink-500);
        margin-bottom: 4px;
      }

      .soporte-contact a {
        color: var(--color-primary-dark);
        text-decoration: none;
      }

      .soporte-contact a:hover {
        text-decoration: underline;
      }

      .soporte-contact p {
        margin: 0;
        line-height: 1.6;
      }

      @media (max-width: 860px) {
        .soporte-grid {
          grid-template-columns: 1fr;
          gap: 40px;
        }
      }

      @media (max-width: 640px) {
        .soporte-main {
          padding: 104px 0 56px;
        }
      }
    `,
  ],
})
export class SoportePageComponent {
  constructor() {
    applySeo({
      title: 'Soporte',
      description:
        'Centro de ayuda de Kengo: preguntas frecuentes, contacto directo y formulario de soporte para fisioterapeutas, clínicas y pacientes.',
      canonical: CANONICAL,
    });
  }
}
