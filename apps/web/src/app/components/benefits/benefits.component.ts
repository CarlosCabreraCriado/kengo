import {
  Component,
  AfterViewInit,
  QueryList,
  ViewChildren,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-benefits',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="beneficios" class="benefits-section">
      <!-- Aurora Background -->
      <div class="aurora-bg-layer">
        <div class="bg-orb orb-coral"></div>
        <div class="bg-orb orb-amber"></div>
      </div>

      <div class="wrapper">
        <!-- ── Section Header ─────────────────────────── -->
        <header class="section-head">
          <div class="eyebrow-row">
            <span class="ey-line"></span>
            <span class="ey-label">Para cada rol</span>
            <span class="ey-line ey-line-r"></span>
          </div>
          <h2 class="section-h2">
            Una plataforma,
            <br />
            <em class="h2-accent">tres experiencias</em>
          </h2>
          <p class="section-sub">
            Cada usuario encuentra exactamente lo que necesita.<br />
            Herramientas especializadas que transforman la rehabilitación.
          </p>
        </header>

        <!-- ── Cards ─────────────────────────────────── -->
        <div class="cards-grid">
          @for (seg of segments; track seg.id; let i = $index) {
            <article
              #segCard
              class="kcard"
              [class]="'kcard-' + seg.id"
              [class.kcard-featured]="seg.featured"
              [style.--i]="i"
              [style.--c1]="seg.color1"
              [style.--c2]="seg.color2"
              [style.--clight]="seg.colorLight"
            >
              <!-- ── Cap: colored header block ────────── -->
              <div class="cap">
                <div class="cap-dots"></div>
                <div class="cap-ring cap-ring-1"></div>
                <div class="cap-ring cap-ring-2"></div>
                <div class="cap-num">{{ i < 9 ? '0' + (i + 1) : i + 1 }}</div>

                <div class="cap-top">
                  <span class="tier-pill">
                    <span class="tier-dot"></span>
                    {{ seg.tag }}
                  </span>
                  @if (seg.featured) {
                    <span class="feat-pill">★ Recomendado</span>
                  }
                </div>

                <h3 class="cap-title">{{ seg.title }}</h3>

                <!-- Wave cutout -->
                <div class="cap-wave">
                  <svg
                    viewBox="0 0 500 48"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M0,8 C80,48 220,0 360,32 C420,44 470,20 500,28 L500,48 L0,48 Z"
                      fill="white"
                    />
                  </svg>
                </div>
              </div>

              <!-- ── Body ─────────────────────────────── -->
              <div class="body">
                <p class="body-desc">{{ seg.description }}</p>

                <ul class="perks">
                  @for (b of seg.benefits; track b.text; let j = $index) {
                    <li class="perk" [style.--j]="j">
                      <span class="perk-check">
                        <svg viewBox="0 0 14 14" fill="none">
                          <path
                            d="M2.5 7l3 3L11.5 4"
                            stroke="currentColor"
                            stroke-width="2.2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </span>
                      <span class="perk-text">{{ b.text }}</span>
                      @if (b.highlight) {
                        <span class="perk-chip">{{ b.highlight }}</span>
                      }
                    </li>
                  }
                </ul>

                <a [href]="seg.ctaLink" class="cta-btn">
                  <span>{{ seg.cta }}</span>
                  <span class="cta-arrow">
                    <svg viewBox="0 0 20 20" fill="none">
                      <path
                        d="M4 10h12M10 4l6 6-6 6"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>
                </a>
              </div>
            </article>
          }
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      /* ═══════════════════════════════════════════
         SECTION
      ═══════════════════════════════════════════ */
      .benefits-section {
        position: relative;
        padding: 6rem 0 3rem;
        background: linear-gradient(
          180deg,
          #fff 0%,
          #fffaf5 25%,
          #fff5eb 60%,
          #ffedde 100%
        );
        overflow: hidden;
      }

      @media (min-width: 1024px) {
        .benefits-section {
          padding: 8rem 0 4rem;
        }
      }

      /* Aurora orbs */
      .aurora-bg-layer {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      }

      .bg-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(90px);
        pointer-events: none;
        will-change: transform;
      }
      .orb-coral {
        width: 600px;
        height: 600px;
        top: -10%;
        right: -8%;
        background: radial-gradient(
          circle,
          rgba(231, 92, 62, 0.28) 0%,
          transparent 70%
        );
        animation: benefitOrbFloat1 22s ease-in-out infinite;
      }
      .orb-amber {
        width: 500px;
        height: 500px;
        bottom: -10%;
        left: -10%;
        background: radial-gradient(
          circle,
          rgba(239, 192, 72, 0.24) 0%,
          transparent 70%
        );
        animation: benefitOrbFloat2 28s ease-in-out infinite;
      }

      @keyframes benefitOrbFloat1 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(50px, 40px) scale(1.12); }
        66% { transform: translate(-30px, 60px) scale(1.05); }
      }

      @keyframes benefitOrbFloat2 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(60px, -50px) scale(1.1); }
      }

      /* ═══════════════════════════════════════════
         WRAPPER
      ═══════════════════════════════════════════ */
      .wrapper {
        position: relative;
        z-index: 1;
        max-width: 1220px;
        margin: 0 auto;
        padding: 0 1.5rem;
      }
      @media (min-width: 640px) {
        .wrapper {
          padding: 0 2rem;
        }
      }
      @media (min-width: 1024px) {
        .wrapper {
          padding: 0 3rem;
        }
      }

      /* ═══════════════════════════════════════════
         SECTION HEADER
      ═══════════════════════════════════════════ */
      .section-head {
        text-align: center;
        max-width: 680px;
        margin: 0 auto 3.5rem;
      }

      .eyebrow-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.9rem;
        margin-bottom: 1.4rem;
      }
      .ey-line {
        flex: 1;
        max-width: 56px;
        height: 1.5px;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(231, 92, 62, 0.55)
        );
      }
      .ey-line-r {
        background: linear-gradient(
          90deg,
          rgba(231, 92, 62, 0.55),
          transparent
        );
      }
      .ey-label {
        font-size: 11.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: #e75c3e;
      }

      .section-h2 {
        font-family: 'Galvji', system-ui, sans-serif;
        font-size: clamp(2rem, 5.5vw, 3.4rem);
        font-weight: 700;
        color: #1a1208;
        line-height: 1.1;
        letter-spacing: -0.025em;
        margin: 0 0 1.2rem;
      }
      .h2-accent {
        font-style: italic;
        padding-right: 0.12em;
        background: linear-gradient(
          120deg,
          #e75c3e 0%,
          #d97706 45%,
          #efc048 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .section-sub {
        font-size: 1.0625rem;
        color: #7c6f62;
        line-height: 1.7;
        margin: 0;
      }

      /* ═══════════════════════════════════════════
         GRID
      ═══════════════════════════════════════════ */
      .cards-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.25rem;
      }

      @media (min-width: 768px) {
        .cards-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        .kcard-clinicas {
          grid-column: span 2;
          max-width: 500px;
          justify-self: center;
          width: 100%;
        }
      }

      @media (min-width: 1024px) {
        .cards-grid {
          grid-template-columns: repeat(3, 1fr);
          align-items: start;
        }
        .kcard-clinicas {
          grid-column: span 1;
          max-width: none;
        }
      }

      /* ═══════════════════════════════════════════
         CARD
      ═══════════════════════════════════════════ */
      .kcard {
        position: relative;
        background: rgba(255, 255, 255, 0.78);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.55);
        border-radius: 26px;
        overflow: hidden;
        box-shadow:
          0 4px 24px rgba(231, 92, 62, 0.06),
          0 1px 4px rgba(0, 0, 0, 0.03),
          inset 0 1px 0 rgba(255, 255, 255, 0.8);
        transition:
          transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
          box-shadow 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        animation: cardReveal 0.55s ease-out calc(var(--i) * 0.11s) both;
      }

      @keyframes cardReveal {
        from {
          opacity: 0;
          transform: translateY(36px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .kcard:hover {
        transform: translateY(-10px);
        background: rgba(255, 255, 255, 0.90);
        box-shadow:
          0 8px 40px rgba(231, 92, 62, 0.1),
          0 24px 64px rgba(26, 18, 8, 0.07),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
      }

      /* Featured card */
      .kcard-featured {
        box-shadow:
          0 0 0 2px var(--c1),
          0 8px 40px color-mix(in srgb, var(--c1) 22%, transparent),
          0 2px 8px rgba(26, 18, 8, 0.06),
          inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }
      .kcard-featured:hover {
        box-shadow:
          0 0 0 2px var(--c1),
          0 24px 64px color-mix(in srgb, var(--c1) 28%, transparent),
          0 8px 24px rgba(26, 18, 8, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
      }

      @media (min-width: 1024px) {
        .kcard-featured {
          margin-top: -10px;
        }
      }

      /* ═══════════════════════════════════════════
         CAP – COLORED HEADER BLOCK
      ═══════════════════════════════════════════ */
      .cap {
        position: relative;
        background: linear-gradient(140deg, var(--c1) 0%, var(--c2) 100%);
        padding: 1.75rem 1.75rem 3.25rem;
        overflow: hidden;
        min-height: 168px;
      }

      /* Dot grid texture */
      .cap-dots {
        position: absolute;
        inset: 0;
        background-image: radial-gradient(
          circle,
          rgba(255, 255, 255, 0.28) 1.2px,
          transparent 1.2px
        );
        background-size: 18px 18px;
        pointer-events: none;
      }

      /* Decorative concentric rings */
      .cap-ring {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
      }
      .cap-ring-1 {
        width: 200px;
        height: 200px;
        right: -70px;
        top: -70px;
        border: 44px solid rgba(255, 255, 255, 0.07);
      }
      .cap-ring-2 {
        width: 110px;
        height: 110px;
        right: 48px;
        top: 24px;
        border: 1.5px solid rgba(255, 255, 255, 0.18);
      }

      /* Faint large background number */
      .cap-num {
        position: absolute;
        right: 14px;
        bottom: 28px;
        font-family: 'Galvji', monospace;
        font-size: 5rem;
        font-weight: 900;
        color: rgba(255, 255, 255, 0.09);
        line-height: 1;
        letter-spacing: -0.05em;
        pointer-events: none;
        user-select: none;
        z-index: 0;
      }

      /* Badge row */
      .cap-top {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 1.1rem;
        position: relative;
        z-index: 1;
      }

      .tier-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 5px 14px;
        background: rgba(255, 255, 255, 0.22);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.38);
        border-radius: 100px;
        color: white;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.11em;
        white-space: nowrap;
      }

      .tier-dot {
        width: 6px;
        height: 6px;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        flex-shrink: 0;
        animation: tierDotPulse 2.2s ease-in-out infinite;
      }

      @keyframes tierDotPulse {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.4;
          transform: scale(0.65);
        }
      }

      .feat-pill {
        display: inline-flex;
        align-items: center;
        padding: 5px 12px;
        background: white;
        color: var(--c1);
        font-size: 10px;
        font-weight: 900;
        border-radius: 100px;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }

      /* Card title */
      .cap-title {
        font-family: 'Galvji', system-ui, sans-serif;
        font-size: 1.4rem;
        font-weight: 800;
        color: white;
        margin: 0;
        line-height: 1.2;
        letter-spacing: -0.015em;
        position: relative;
        z-index: 1;
      }

      /* Wave cutout at bottom of cap */
      .cap-wave {
        position: absolute;
        bottom: -1px;
        left: -2px;
        right: -2px;
        height: 48px;
        pointer-events: none;
        z-index: 2;
      }
      .cap-wave svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      /* ═══════════════════════════════════════════
         BODY
      ═══════════════════════════════════════════ */
      .body {
        padding: 1.25rem 1.75rem 1.75rem;
      }

      .body-desc {
        font-size: 13.5px;
        color: #7c6f62;
        line-height: 1.68;
        margin: 0 0 1.3rem;
      }

      /* ═══════════════════════════════════════════
         PERKS LIST
      ═══════════════════════════════════════════ */
      .perks {
        list-style: none;
        padding: 0;
        margin: 0 0 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .perk {
        display: flex;
        align-items: center;
        gap: 10px;
        opacity: 0;
        transform: translateX(-12px);
        transition:
          opacity 0.38s ease calc(var(--j) * 0.07s),
          transform 0.38s ease calc(var(--j) * 0.07s);
      }

      .kcard.card-visible .perk {
        opacity: 1;
        transform: translateX(0);
      }

      .perk-check {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border-radius: 7px;
        background: linear-gradient(140deg, var(--c1), var(--c2));
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 2px 8px color-mix(in srgb, var(--c1) 35%, transparent);
        transition: transform 0.25s ease;
      }

      .kcard:hover .perk-check {
        transform: scale(1.08);
      }

      .perk-check svg {
        width: 11px;
        height: 11px;
      }

      .perk-text {
        flex: 1;
        font-size: 13.5px;
        font-weight: 500;
        color: #2d2416;
        line-height: 1.45;
      }

      .perk-chip {
        font-size: 9.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--c1);
        background: var(--clight);
        padding: 3px 8px;
        border-radius: 5px;
        flex-shrink: 0;
      }

      /* ═══════════════════════════════════════════
         CTA BUTTON
      ═══════════════════════════════════════════ */
      .cta-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 13px 18px;
        background: linear-gradient(140deg, var(--c1), var(--c2));
        color: white;
        border-radius: 14px;
        text-decoration: none;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.01em;
        position: relative;
        overflow: hidden;
        transition: all 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .cta-btn::after {
        content: '';
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0);
        transition: background 0.3s ease;
      }

      .cta-btn:hover::after {
        background: rgba(255, 255, 255, 0.1);
      }

      .cta-btn:hover {
        box-shadow: 0 6px 24px color-mix(in srgb, var(--c1) 45%, transparent);
        transform: translateY(-2px);
      }

      .cta-arrow {
        display: flex;
        align-items: center;
        position: relative;
        z-index: 1;
        transition: transform 0.3s ease;
      }

      .cta-arrow svg {
        width: 18px;
        height: 18px;
      }

      .cta-btn:hover .cta-arrow {
        transform: translateX(4px);
      }

      .cta-btn span:first-child {
        position: relative;
        z-index: 1;
      }

      /* ═══════════════════════════════════════════
         REDUCED MOTION
      ═══════════════════════════════════════════ */
      @media (prefers-reduced-motion: reduce) {
        .bg-orb,
        .kcard,
        .perk,
        .tier-dot,
        .cta-btn,
        .perk-check {
          animation: none !important;
          transition: none !important;
        }
        .perk {
          opacity: 1;
          transform: none;
        }
        .kcard {
          animation: none;
        }
      }
    `,
  ],
})
export class BenefitsComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('segCard') cards!: QueryList<ElementRef>;
  private observer: IntersectionObserver | null = null;

  ngAfterViewInit() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      this.cards.forEach((c) => c.nativeElement.classList.add('card-visible'));
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('card-visible');
            this.observer?.unobserve(e.target);
          }
        }),
      { threshold: 0.1 },
    );
    this.cards.forEach((c) => this.observer!.observe(c.nativeElement));
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  segments = [
    {
      id: 'pacientes',
      title: 'Para Pacientes',
      tag: 'Gratis',
      color1: '#e75c3e',
      color2: '#f7873e',
      colorLight: 'rgba(231, 92, 62, 0.1)',
      featured: false,
      cta: 'Empezar ahora',
      ctaLink: 'https://kengoapp.com/registro',
      description:
        'Tu fisio siempre contigo. Ejercicios guiados con video, seguimiento del dolor y comunicación directa.',
      benefits: [
        { text: 'Ejercicios con video HD profesional', highlight: null },
        { text: 'Sabe exactamente qué hacer cada día', highlight: null },
        { text: 'Registra cómo te sientes', highlight: 'Nuevo' },
        { text: 'Tu fisio siempre informado', highlight: null },
      ],
    },
    {
      id: 'fisioterapeutas',
      title: 'Para Fisioterapeutas',
      tag: 'Pro',
      color1: '#c47d0a',
      color2: '#efc048',
      colorLight: 'rgba(196, 125, 10, 0.1)',
      featured: false,
      cta: 'Crear cuenta',
      ctaLink: 'https://kengoapp.com/registro?role=fisio',
      description:
        'Herramientas profesionales para crear planes, gestionar pacientes y monitorizar adherencia en tiempo real.',
      benefits: [
        { text: 'Crea planes en minutos, no horas', highlight: null },
        { text: '+500 ejercicios en el catálogo', highlight: 'HD' },
        { text: 'Monitoriza adherencia real', highlight: null },
        { text: 'Plantillas reutilizables', highlight: null },
      ],
    },
    {
      id: 'clinicas',
      title: 'Para Clínicas',
      tag: 'Enterprise',
      color1: '#5254cc',
      color2: '#8b5cf6',
      colorLight: 'rgba(82, 84, 204, 0.1)',
      featured: false,
      cta: 'Contactar ventas',
      ctaLink: 'mailto:contacto@kengoapp.com',
      description:
        'Escala tu clínica con gestión centralizada del equipo, códigos de acceso seguros y branding personalizado.',
      benefits: [
        { text: 'Gestión centralizada del equipo', highlight: null },
        { text: 'Códigos de acceso seguros', highlight: null },
        { text: 'Tu marca, tu identidad', highlight: 'Branding' },
        { text: 'Escala sin complicaciones', highlight: null },
      ],
    },
  ];
}
