import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { ContactFormComponent } from '../../components/contact-form/contact-form.component';
import { environment } from '../../../environments/environment';
import { applySeo } from '../../shared/seo';

const CANONICAL = 'https://www.kengoapp.com/eliminar-cuenta';

/**
 * Página pública de solicitud de eliminación de cuenta.
 *
 * Google Play exige, además del borrado desde dentro de la app, una URL
 * accesible **sin instalar la aplicación** donde el usuario pueda solicitar
 * la eliminación de su cuenta y de sus datos. Esta URL se declara en el
 * formulario de Data Safety.
 */
@Component({
  selector: 'web-eliminar-cuenta-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [HeaderComponent, FooterComponent, ContactFormComponent, RouterLink],
  template: `
    <web-header />

    <main class="cuenta-main">
      <div class="cuenta-wrap">
        <header class="cuenta-head">
          <p class="cuenta-overline">Tu cuenta</p>
          <h1>Eliminar tu cuenta y tus datos</h1>
          <p class="cuenta-sub">
            Puedes eliminar tu cuenta de Kengo en cualquier momento. Aquí te
            explicamos cómo hacerlo y qué ocurre con tu información.
          </p>
        </header>

        <section class="cuenta-block">
          <h2>Opción 1: desde la aplicación (recomendado)</h2>
          <p>Es la vía más rápida y no requiere esperar a que la tramitemos.</p>
          <ol>
            <li>Abre Kengo e inicia sesión.</li>
            <li>Ve a <strong>Perfil</strong>.</li>
            <li>Abre la sección <strong>Eliminar cuenta</strong>.</li>
            <li>Confirma la operación siguiendo las instrucciones.</li>
          </ol>
          <p>
            <a [href]="appUrl + '/perfil'" class="cuenta-btn">
              Ir a mi perfil
            </a>
          </p>
        </section>

        <section class="cuenta-block">
          <h2>Opción 2: solicítalo por este formulario</h2>
          <p>
            Si ya no tienes acceso a la aplicación, escríbenos indicando el
            correo electrónico con el que te registraste. Verificaremos tu
            identidad antes de proceder y te confirmaremos cuando esté hecho.
            Atendemos la solicitud en un plazo máximo de 30 días.
          </p>
          <web-contact-form
            idPrefix="borrado"
            submitLabel="Solicitar eliminación"
            asuntoPlaceholder="Solicitud de eliminación de cuenta"
          />
        </section>

        <section class="cuenta-block">
          <h2>Qué datos se eliminan</h2>
          <ul>
            <li>Tu perfil y tus datos de contacto.</li>
            <li>Tu foto de perfil.</li>
            <li>Tus planes de ejercicios y rutinas.</li>
            <li>
              Tus sesiones, ejercicios realizados y registros de dolor y
              adherencia.
            </li>
            <li>Tus conversaciones y mensajes.</li>
            <li>
              Tus preferencias de notificación y los identificadores de tus
              dispositivos.
            </li>
          </ul>
        </section>

        <section class="cuenta-block">
          <h2>Qué datos se conservan y durante cuánto tiempo</h2>
          <ul>
            <li>
              <strong>Facturación:</strong> las facturas emitidas se conservan
              durante los plazos que exige la normativa fiscal y mercantil.
            </li>
            <li>
              <strong>Historia clínica:</strong> cuando la responsable del
              tratamiento sea la clínica, la documentación asistencial se
              conserva durante los plazos previstos en la normativa sanitaria.
            </li>
            <li>
              <strong>Bloqueo legal:</strong> el resto de la información queda
              bloqueada, sin uso activo, durante un máximo de 2 años, para
              atender posibles reclamaciones o requerimientos de la
              Administración.
            </li>
          </ul>
          <p>
            Puedes consultar el detalle en nuestra
            <a routerLink="/legal/privacidad">Política de privacidad</a>.
          </p>
        </section>

        <section class="cuenta-block cuenta-block--warn">
          <h2>Antes de eliminar tu cuenta</h2>
          <ul>
            <li>
              <strong>La eliminación es irreversible.</strong> No podremos
              recuperar tu historial ni tus planes.
            </li>
            <li>
              Si eres propietario de una clínica, transfiere primero la
              propiedad a otro administrador.
            </li>
            <li>
              Si tu clínica tiene una suscripción activa, cancélala antes para
              evitar cobros posteriores.
            </li>
          </ul>
        </section>
      </div>
    </main>

    <web-footer />
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .cuenta-main {
        background: var(--color-cream);
        padding: 132px 0 72px;
      }

      .cuenta-wrap {
        max-width: 760px;
        margin: 0 auto;
        padding: 0 20px;
      }

      .cuenta-head {
        padding-bottom: 24px;
        margin-bottom: 8px;
        border-bottom: 1px solid var(--color-ink-200);
      }

      .cuenta-overline {
        margin: 0 0 10px;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #a34a2c;
        font-weight: 700;
      }

      .cuenta-head h1 {
        margin: 0;
        font-size: clamp(28px, 5vw, 40px);
        line-height: 1.1;
        color: var(--color-ink);
        letter-spacing: -0.02em;
      }

      .cuenta-sub {
        margin: 14px 0 0;
        font-size: 16px;
        line-height: 1.6;
        color: var(--color-ink-700);
        max-width: 62ch;
      }

      .cuenta-block {
        padding: 28px 0;
        border-bottom: 1px solid var(--color-ink-200);
      }

      .cuenta-block:last-child {
        border-bottom: none;
      }

      .cuenta-block h2 {
        margin: 0 0 12px;
        font-size: 19px;
        color: var(--color-ink);
      }

      .cuenta-block p,
      .cuenta-block li {
        font-size: 14px;
        line-height: 1.6;
        color: var(--color-ink-700);
      }

      .cuenta-block p {
        margin: 0 0 10px;
      }

      .cuenta-block ul,
      .cuenta-block ol {
        margin: 8px 0 12px;
        padding-left: 20px;
      }

      .cuenta-block li {
        margin-bottom: 6px;
      }

      .cuenta-block strong {
        color: var(--color-ink);
      }

      .cuenta-block a:not(.cuenta-btn) {
        color: var(--color-primary-dark);
      }

      .cuenta-btn {
        display: inline-block;
        margin-top: 4px;
        background: var(--color-primary);
        color: #fff;
        border-radius: 999px;
        padding: 12px 24px;
        font-size: 15px;
        font-weight: 700;
        text-decoration: none;
        box-shadow: 0 8px 22px rgba(224, 112, 79, 0.28);
      }

      .cuenta-btn:hover {
        background: var(--color-primary-dark);
      }

      .cuenta-block--warn {
        background: rgba(224, 112, 79, 0.07);
        border: 1px solid rgba(224, 112, 79, 0.25);
        border-radius: 18px;
        padding: 24px;
        margin-top: 28px;
      }

      @media (max-width: 640px) {
        .cuenta-main {
          padding: 104px 0 56px;
        }
      }
    `,
  ],
})
export class EliminarCuentaPageComponent {
  protected readonly appUrl = environment.appUrl;

  constructor() {
    applySeo({
      title: 'Eliminar tu cuenta',
      description:
        'Cómo eliminar tu cuenta de Kengo y tus datos personales, qué información se borra, cuál se conserva por obligación legal y durante cuánto tiempo.',
      canonical: CANONICAL,
    });
  }
}
