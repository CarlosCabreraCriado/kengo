import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';
import {
  EQUIPO,
  LOGOS_CLIENTES,
  LOGOS_COLABORADORES,
} from '../../shared/site-config';

/**
 * «Quién está detrás»: equipo, clínicas clientes y colaboraciones.
 *
 * Cada bloque se pinta solo si su lista en `site-config.ts` tiene datos:
 * nunca se muestran logos o personas de ejemplo.
 */
@Component({
  selector: 'web-team',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ScrollAnimateDirective],
  template: `
    <section class="team" id="equipo">
      <div class="wrap">
        <div class="head scroll-reveal" webScrollAnimate>
          <span class="eyebrow">Quién está detrás</span>
          <h2 class="font-display">Hecho por fisios,<br />para fisios</h2>
          <p>
            Detrás de Kengo hay fisioterapeutas que vivían el mismo problema que
            tú: el paciente sale de la consulta y el tratamiento se queda en la
            camilla. Lo construimos en Canarias, codo con codo con las clínicas
            que ya lo usan.
          </p>
        </div>

        @if (equipo.length) {
          <div class="people scroll-reveal-stagger" webScrollAnimate>
            @for (m of equipo; track m.nombre) {
              <article class="person">
                @if (m.foto) {
                  <img [src]="m.foto" [alt]="m.nombre" width="72" height="72" loading="lazy" />
                } @else {
                  <span class="initial" aria-hidden="true">{{ m.nombre.charAt(0) }}</span>
                }
                <div>
                  <b>{{ m.nombre }}</b>
                  <span class="rol">{{ m.rol }}</span>
                  <p>{{ m.bio }}</p>
                </div>
              </article>
            }
          </div>
        }

        @if (clientes.length) {
          <div class="logos-block">
            <h3>Clínicas que ya trabajan con Kengo</h3>
            <ul class="logos">
              @for (l of clientes; track l.nombre) {
                <li>
                  @if (l.url) {
                    <a [href]="l.url" target="_blank" rel="noopener">
                      <img [src]="l.src" [alt]="l.nombre" loading="lazy" />
                    </a>
                  } @else {
                    <img [src]="l.src" [alt]="l.nombre" loading="lazy" />
                  }
                </li>
              }
            </ul>
          </div>
        }

        @if (colaboradores.length) {
          <div class="logos-block">
            <h3>Colaboramos con</h3>
            <ul class="logos">
              @for (l of colaboradores; track l.nombre) {
                <li>
                  @if (l.url) {
                    <a [href]="l.url" target="_blank" rel="noopener">
                      <img [src]="l.src" [alt]="l.nombre" loading="lazy" />
                    </a>
                  } @else {
                    <img [src]="l.src" [alt]="l.nombre" loading="lazy" />
                  }
                </li>
              }
            </ul>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .team {
        padding: 112px 0;
        background: var(--color-mist);
      }

      .team .eyebrow {
        color: #2f5a35;
      }
      .team .eyebrow::before {
        background: #3f6b45;
      }

      .team .head p {
        color: var(--color-ink-strong);
      }

      .people {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 18px;
        margin-top: 48px;
      }

      .person {
        display: flex;
        gap: 16px;
        align-items: flex-start;
        background: #fff;
        border-radius: 24px;
        padding: 22px;
      }

      .person img,
      .initial {
        flex: none;
        width: 72px;
        height: 72px;
        border-radius: 50%;
        object-fit: cover;
      }

      .initial {
        display: grid;
        place-items: center;
        background: var(--color-primary);
        color: #fff;
        font-size: 28px;
        font-weight: 700;
      }

      .person b {
        display: block;
        font-size: 17px;
        color: var(--color-ink-strong);
      }

      .rol {
        display: block;
        margin-top: 2px;
        font-size: 13px;
        font-weight: 600;
        color: #2f5a35;
      }

      .person p {
        margin: 8px 0 0;
        font-size: 14.5px;
        line-height: 1.55;
        color: var(--color-ink-strong);
      }

      .logos-block {
        margin-top: 56px;
      }

      .logos-block h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--color-ink-strong);
      }

      .logos {
        list-style: none;
        margin: 20px 0 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 18px 40px;
      }

      .logos img {
        height: 44px;
        width: auto;
        max-width: 180px;
        object-fit: contain;
      }

      @media (max-width: 640px) {
        .team {
          padding: 76px 0;
        }
        .logos {
          gap: 16px 28px;
        }
        .logos img {
          height: 36px;
        }
      }
    `,
  ],
})
export class TeamComponent {
  protected readonly equipo = EQUIPO;
  protected readonly clientes = LOGOS_CLIENTES;
  protected readonly colaboradores = LOGOS_COLABORADORES;
}
