import { Component } from '@angular/core';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

@Component({
  selector: 'web-clinicas',
  standalone: true,
  imports: [ScrollAnimateDirective],
  template: `
    <section class="brand-sec" id="clinicas">
      <div class="wrap brand-in scroll-reveal" webScrollAnimate>
        <div>
          <span class="eyebrow">Para clínicas</span>
          <h2 class="font-display">Tu clínica,<br />tus colores</h2>
          <p>
            Logo, color corporativo y datos de la clínica. Tus pacientes ven tu
            marca, no la nuestra. Y tú gestionas todo el equipo desde un solo
            panel.
          </p>
          <ul class="ticks">
            <li>Códigos de acceso para dar de alta fisios y pacientes sin fricción</li>
            <li>Varias clínicas bajo un mismo usuario</li>
            <li>Actividad y adherencia agregadas de todo el centro</li>
          </ul>
          <div class="swatches">
            <span class="swatch" style="background:#e0704f"></span>
            <span class="swatch" style="background:#5d8a5f"></span>
            <span class="swatch" style="background:#6b8fc4"></span>
            <span class="swatch" style="background:#a8617c"></span>
          </div>
        </div>
        <div class="mock-wrap">
          <picture>
            <source
              type="image/avif"
              srcset="
                assets/shots/personalizacion-640w.avif   640w,
                assets/shots/personalizacion-960w.avif   960w,
                assets/shots/personalizacion-1280w.avif 1280w
              "
              sizes="(max-width: 560px) 92vw, 520px"
            />
            <source
              type="image/webp"
              srcset="
                assets/shots/personalizacion-640w.webp   640w,
                assets/shots/personalizacion-960w.webp   960w,
                assets/shots/personalizacion-1280w.webp 1280w
              "
              sizes="(max-width: 560px) 92vw, 520px"
            />
            <img
              class="mock"
              src="assets/shots/personalizacion-960w.png"
              width="1500"
              height="1592"
              alt="La app de Kengo personalizada con distintos colores de clínica"
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

      .brand-sec {
        padding: 112px 0;
        background: var(--color-mist);
      }

      .brand-in {
        display: grid;
        grid-template-columns: 0.95fr 1.05fr;
        gap: 56px;
        align-items: center;
      }

      h2 {
        font-size: clamp(36px, 4.2vw, 56px);
        margin: 18px 0 0;
        color: var(--color-ink);
      }

      p {
        font-size: 17px;
        line-height: 1.68;
        color: var(--color-ink-700);
        margin: 20px 0 0;
        max-width: 30em;
      }

      .swatches {
        display: flex;
        gap: 10px;
        margin-top: 28px;
      }

      .swatch {
        width: 38px;
        height: 38px;
        border-radius: 14px;
        box-shadow: 0 6px 16px rgba(150, 100, 70, 0.16);
        border: 2px solid #fff;
      }

      @media (max-width: 1080px) {
        .brand-in {
          grid-template-columns: 1fr;
          gap: 44px;
        }
      }

      @media (max-width: 640px) {
        .brand-sec {
          padding: 76px 0;
        }
        .brand-in {
          gap: 36px;
        }
      }
    `,
  ],
})
export class ClinicasComponent {}
