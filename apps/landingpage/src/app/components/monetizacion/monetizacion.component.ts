import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';
import { ContactoDialogService } from '../../shared/contacto-dialog.service';
import { PLANES_WEB } from '../../shared/site-config';

interface Idea {
  titulo: string;
  copy: string;
}

/**
 * «Monetización»: cómo la clínica convierte Kengo en ingresos. Son servicios
 * que la clínica cobra por su cuenta, fuera de Kengo; no prometer funciones
 * que el producto no tenga ni cifras de resultados que no podamos respaldar.
 *
 * El gancho final abre el popup «Te llamamos». Antes de hidratar (o sin JS)
 * el mismo enlace baja al formulario `#contacto`. Es un `href` normal y no un
 * `routerLink`: RouterLink navega aunque se haga `preventDefault()`, y la
 * página saltaría a `#contacto` por detrás del popup. La sección solo existe
 * en la home, así que el ancla relativa basta.
 */
@Component({
  selector: 'web-monetizacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ScrollAnimateDirective],
  template: `
    <section class="monet" id="monetizacion">
      <div class="wrap">
        <div class="head scroll-reveal" webScrollAnimate>
          <span class="eyebrow">Monetización</span>
          <h2 class="font-display">Kengo no es un gasto:<br />es una fuente de ingresos</h2>
          <p>
            El trabajo que tu paciente hace en casa también tiene valor. Con
            Kengo puedes ponerle precio y hacer que la clínica facture más allá
            de la camilla.
          </p>
        </div>

        <div class="ideas scroll-reveal" webScrollAnimate>
          @for (idea of ideas; track idea.titulo; let i = $index) {
            <article class="idea">
              <b class="font-display num">0{{ i + 1 }}</b>
              <h3>{{ idea.titulo }}</h3>
              <p>{{ idea.copy }}</p>
            </article>
          }
        </div>

        <div class="roi scroll-reveal" webScrollAnimate>
          <b class="font-display">Sube 1 € por sesión y Kengo te sale gratis</b>
          <p>
            Con {{ planes[0].precioEur }} sesiones al mes ya cubres el plan
            {{ planes[0].nombre }}. Y tu paciente se lleva algo que antes no tenía:
            su plan en el móvil y una línea directa contigo.
          </p>
        </div>

        <div class="gancho scroll-reveal" webScrollAnimate>
          <div>
            <h3 class="font-display">¿Quieres conocer más formas de monetizar Kengo?</h3>
            <p>
              Hay más, y algunas no las contamos aquí. Escríbenos y en una llamada
              de 15 minutos te explicamos cómo aplicarlas en tu clínica.
            </p>
          </div>
          <a href="#contacto" class="btn btn-light" (click)="abrirPopup($event)">
            Quiero que me lo contéis
            <svg fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .monet {
        padding: 112px 0;
        background: var(--color-peach);
      }

      .monet .head p {
        color: var(--color-ink-strong);
      }

      .ideas {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 22px;
        margin-top: 56px;
      }

      .idea {
        background: #fff;
        border: 1px solid var(--color-ink-200);
        border-radius: 26px;
        padding: 28px 26px;
      }

      .num {
        display: block;
        font-size: 13px;
        letter-spacing: 0.2em;
        color: #a34a2c;
        margin-bottom: 12px;
      }

      .idea h3 {
        margin: 0;
        font-size: 19px;
        font-weight: 700;
        color: var(--color-ink);
      }

      .idea p {
        margin: 10px 0 0;
        font-size: 15px;
        line-height: 1.6;
        color: var(--color-ink-700);
      }

      .roi {
        margin-top: 22px;
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

      .gancho {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
        margin-top: 22px;
        padding: 30px 32px;
        border-radius: 24px;
        background: #3f6b45;
        color: #fff;
      }

      .gancho > div {
        flex: 1;
        min-width: 240px;
      }

      .gancho h3 {
        margin: 0;
        font-size: clamp(22px, 2.4vw, 28px);
        line-height: 1.25;
      }

      .gancho p {
        margin: 10px 0 0;
        font-size: 16px;
        line-height: 1.6;
        max-width: 40em;
      }

      .gancho .btn-light {
        color: #3f6b45;
      }

      .gancho .btn-light:hover {
        color: #2f5234;
      }

      @media (max-width: 1080px) {
        .ideas {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .monet {
          padding: 76px 0;
        }
        .ideas {
          margin-top: 40px;
        }
        .gancho {
          padding: 24px 20px;
        }
        .gancho .btn {
          width: 100%;
          justify-content: center;
          white-space: normal;
        }
      }
    `,
  ],
})
export class MonetizacionComponent {
  private readonly dialogo = inject(ContactoDialogService);

  protected readonly planes = PLANES_WEB;

  protected readonly ideas: Idea[] = [
    {
      titulo: 'Cobra el seguimiento entre sesiones',
      copy: 'Ofrece un bono mensual de seguimiento en casa: plan con vídeo, chat contigo y avisos si el paciente se descuelga. Un servicio nuevo con el trabajo que ya haces.',
    },
    {
      titulo: 'Vende programas cerrados',
      copy: 'Readaptación deportiva, postparto, espalda… Programas de varias semanas que el paciente sigue en la app con el logo de tu clínica, a un precio cerrado.',
    },
    {
      titulo: 'Menos abandonos, más sesiones',
      copy: 'Las alertas de adherencia te avisan cuando alguien deja de hacer sus ejercicios, para que lo recuperes antes de que abandone el tratamiento.',
    },
  ];

  protected abrirPopup(event: MouseEvent): void {
    event.preventDefault();
    this.dialogo.abrir();
  }
}
