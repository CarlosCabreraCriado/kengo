import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'web-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <header class="hero" id="top">
      <div class="wrap hero-in">
        <div class="hero-copy">
          <h1 class="font-display">
            Tu rehabilitación,<br /><em>siempre contigo</em>
          </h1>
          <p class="lead">
            Tu fisio te deja el plan en el móvil, con vídeo en cada ejercicio, tu
            progreso a la vista y <b>una línea directa con él</b> entre sesiones.
          </p>
          <div class="hero-cta">
            <a href="https://kengoapp.com/login" class="btn btn-primary">
              Empieza gratis
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
            <a href="#fisios" class="btn btn-ghost">Ver la app por dentro</a>
          </div>
        </div>
        <div class="hero-shot">
          <picture>
            <source
              type="image/avif"
              srcset="
                assets/shots/Multidevice-640w.avif   640w,
                assets/shots/Multidevice-960w.avif   960w,
                assets/shots/Multidevice-1280w.avif 1280w,
                assets/shots/Multidevice-1500w.avif 1500w
              "
              sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1240px) calc(100vw - 130px), 1088px"
            />
            <source
              type="image/webp"
              srcset="
                assets/shots/Multidevice-640w.webp   640w,
                assets/shots/Multidevice-960w.webp   960w,
                assets/shots/Multidevice-1280w.webp 1280w,
                assets/shots/Multidevice-1500w.webp 1500w
              "
              sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1240px) calc(100vw - 130px), 1088px"
            />
            <img
              class="mock"
              src="assets/shots/Multidevice-960w.png"
              width="1500"
              height="809"
              alt="Kengo en móvil, tablet y escritorio"
              fetchpriority="high"
            />
          </picture>
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .hero {
        position: relative;
        overflow: hidden;
        padding: 150px 0 0;
        background: radial-gradient(
          120% 92% at 50% -8%,
          #ffdcbc 0%,
          #ffe9d6 36%,
          #fff6ee 66%,
          var(--color-cream) 100%
        );
      }

      .hero::before {
        content: "";
        position: absolute;
        width: 70vw;
        height: 70vw;
        left: -22vw;
        top: -28vw;
        border-radius: 50%;
        background: radial-gradient(
          circle,
          rgba(255, 214, 178, 0.7) 0%,
          transparent 68%
        );
        pointer-events: none;
      }

      .hero::after {
        content: "";
        position: absolute;
        width: 46vw;
        height: 46vw;
        right: -14vw;
        top: 14vw;
        border-radius: 50%;
        background: radial-gradient(
          circle,
          rgba(240, 244, 236, 0.85) 0%,
          transparent 70%
        );
        pointer-events: none;
      }

      .hero-in {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }

      .hero-copy {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
      }

      .hero h1 {
        margin: 0;
        font-size: clamp(38px, 6vw, 90px);
        color: var(--color-ink);
        letter-spacing: 0.02em;
      }

      .hero h1 em {
        font-style: normal;
        color: var(--color-primary);
        position: relative;
      }

      .hero p.lead {
        margin: 22px auto 0;
        max-width: 33em;
        font-size: 19px;
        line-height: 1.62;
        color: var(--color-ink-700);
      }

      .hero p.lead b {
        color: var(--color-ink);
        font-weight: 700;
      }

      .hero-cta {
        display: flex;
        gap: 14px;
        margin-top: 30px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .hero-shot {
        position: relative;
        z-index: 1;
        margin-top: 34px;
        width: 100%;
        max-height: 430px;
        overflow: hidden;
        padding: 0 44px;
      }

      .hero-shot .mock {
        width: 100%;
        max-width: none;
      }

      @media (max-width: 1080px) {
        .hero {
          padding-top: 126px;
        }
        .hero-shot {
          max-height: 330px;
          padding: 0 34px;
        }
      }

      @media (max-width: 640px) {
        .hero {
          padding-top: 112px;
        }
        .hero-shot {
          max-height: none;
          padding: 0 var(--gutter);
        }
        .hero::before,
        .hero::after {
          display: none;
        }
      }
    `,
  ],
})
export class HeroComponent {}
