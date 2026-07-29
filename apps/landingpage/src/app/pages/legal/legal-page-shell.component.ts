import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';

/**
 * Marco común de las páginas legales: cabecera, título, contenido proyectado
 * y pie. El texto de cada documento llega por `<ng-content>` desde
 * `@kengo/legal`, así que este componente solo aporta la presentación.
 */
@Component({
  selector: 'web-legal-page-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [HeaderComponent, FooterComponent],
  template: `
    <web-header />

    <main class="legal-main">
      <div class="legal-wrap">
        <header class="legal-head">
          <p class="legal-overline">Legal</p>
          <h1>{{ title() }}</h1>
          @if (subtitle()) {
            <p class="legal-sub">{{ subtitle() }}</p>
          }
        </header>

        <article class="legal-body">
          <ng-content />

          @if (lastUpdated()) {
            <p class="legal-updated">
              Última actualización: {{ lastUpdated() }}
            </p>
          }
        </article>
      </div>
    </main>

    <web-footer />
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* El header de la landing es fijo; sin este espacio el título quedaría
         por debajo de la barra. */
      .legal-main {
        background: var(--color-cream);
        padding: 132px 0 72px;
      }

      .legal-wrap {
        max-width: 760px;
        margin: 0 auto;
        padding: 0 20px;
      }

      .legal-head {
        padding-bottom: 24px;
        margin-bottom: 28px;
        border-bottom: 1px solid var(--color-ink-200);
      }

      .legal-overline {
        margin: 0 0 10px;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #a34a2c;
        font-weight: 700;
      }

      .legal-head h1 {
        margin: 0;
        font-size: clamp(30px, 5vw, 42px);
        line-height: 1.1;
        color: var(--color-ink);
        letter-spacing: -0.02em;
      }

      .legal-sub {
        margin: 14px 0 0;
        font-size: 16px;
        line-height: 1.6;
        color: var(--color-ink-700);
        max-width: 62ch;
      }

      .legal-body {
        display: block;
      }

      .legal-updated {
        margin: 32px 0 0;
        padding-top: 16px;
        border-top: 1px solid var(--color-ink-200);
        font-size: 13px;
        color: var(--color-ink-500);
      }

      @media (max-width: 640px) {
        .legal-main {
          padding: 104px 0 56px;
        }
      }
    `,
  ],
})
export class LegalPageShellComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly lastUpdated = input<string>('');
}
