import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-how-it-works',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="como-funciona" class="how-it-works-section">
      <!-- Layered Background -->
      <div class="bg-layers">
        <!-- Animated Gradient Mesh -->
        <div class="gradient-mesh"></div>

        <!-- Flowing Waves -->
        <svg class="wave-layer wave-top" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hiw-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fff8f5" />
              <stop offset="50%" stop-color="#ffe8d6" />
              <stop offset="100%" stop-color="#fdd6b3" />
            </linearGradient>
          </defs>
          <path fill="url(#hiw-gradient-1)" fill-opacity="0.6">
            <animate
              attributeName="d"
              dur="20s"
              repeatCount="indefinite"
              values="
                M0,96 C180,160 360,32 540,96 C720,160 900,64 1080,128 C1260,192 1440,80 1440,80 L1440,0 L0,0 Z;
                M0,64 C180,32 360,128 540,64 C720,0 900,128 1080,80 C1260,32 1440,112 1440,112 L1440,0 L0,0 Z;
                M0,80 C180,144 360,16 540,80 C720,144 900,48 1080,112 C1260,176 1440,64 1440,64 L1440,0 L0,0 Z;
                M0,96 C180,160 360,32 540,96 C720,160 900,64 1080,128 C1260,192 1440,80 1440,80 L1440,0 L0,0 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>

        <svg class="wave-layer wave-bottom" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hiw-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fdd6b3" />
              <stop offset="50%" stop-color="#f7a65e" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#ffedd6" />
            </linearGradient>
          </defs>
          <path fill="url(#hiw-gradient-2)" fill-opacity="0.5">
            <animate
              attributeName="d"
              dur="25s"
              repeatCount="indefinite"
              values="
                M0,224 C320,160 640,288 960,224 C1280,160 1440,256 1440,256 L1440,320 L0,320 Z;
                M0,256 C320,320 640,192 960,256 C1280,320 1440,224 1440,224 L1440,320 L0,320 Z;
                M0,240 C320,176 640,304 960,240 C1280,176 1440,272 1440,272 L1440,320 L0,320 Z;
                M0,224 C320,160 640,288 960,224 C1280,160 1440,256 1440,256 L1440,320 L0,320 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
          <path fill="#e75c3e" fill-opacity="0.04">
            <animate
              attributeName="d"
              dur="30s"
              repeatCount="indefinite"
              values="
                M0,256 C400,192 800,320 1200,256 C1320,224 1440,288 1440,288 L1440,320 L0,320 Z;
                M0,224 C400,288 800,160 1200,224 C1320,256 1440,192 1440,192 L1440,320 L0,320 Z;
                M0,272 C400,208 800,336 1200,272 C1320,240 1440,304 1440,304 L1440,320 L0,320 Z;
                M0,256 C400,192 800,320 1200,256 C1320,224 1440,288 1440,288 L1440,320 L0,320 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>

        <!-- Decorative Orbs -->
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>

        <!-- Grain Texture -->
        <div class="grain-overlay"></div>
      </div>

      <!-- Content Container -->
      <div class="content-container">
        <!-- Editorial Header -->
        <header class="section-header">
          <div class="header-meta">
            <span class="meta-line"></span>
            <span class="meta-badge">
              <span class="badge-dot"></span>
              Proceso simple
            </span>
            <span class="meta-line"></span>
          </div>

          <h2 class="section-title">
            <span class="title-line">Tu recuperacion,</span>
            <span class="title-accent">paso a paso</span>
          </h2>

          <p class="section-intro">
            De la prescripcion a la rehabilitacion completa en 4 pasos.
            Sin complicaciones, con resultados.
          </p>
        </header>

        <!-- Editorial Timeline Grid -->
        <div class="timeline-editorial">
          <!-- Desktop Flow Line -->
          <div class="flow-line-container">
            <svg class="flow-line" viewBox="0 0 1200 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#e75c3e" />
                  <stop offset="33%" stop-color="#f7a65e" />
                  <stop offset="66%" stop-color="#efc048" />
                  <stop offset="100%" stop-color="#22c55e" />
                </linearGradient>
              </defs>
              <path
                class="flow-path"
                d="M0,50 C150,20 250,80 400,50 C550,20 650,80 800,50 C950,20 1050,80 1200,50"
                fill="none"
                stroke="url(#flow-gradient)"
                stroke-width="3"
                stroke-linecap="round"
              />
              <circle class="flow-dot flow-dot-1" r="6" fill="#e75c3e">
                <animateMotion dur="6s" repeatCount="indefinite" path="M0,50 C150,20 250,80 400,50 C550,20 650,80 800,50 C950,20 1050,80 1200,50" />
              </circle>
              <circle class="flow-dot flow-dot-2" r="5" fill="#efc048">
                <animateMotion dur="6s" repeatCount="indefinite" begin="-2s" path="M0,50 C150,20 250,80 400,50 C550,20 650,80 800,50 C950,20 1050,80 1200,50" />
              </circle>
              <circle class="flow-dot flow-dot-3" r="4" fill="#22c55e">
                <animateMotion dur="6s" repeatCount="indefinite" begin="-4s" path="M0,50 C150,20 250,80 400,50 C550,20 650,80 800,50 C950,20 1050,80 1200,50" />
              </circle>
            </svg>
          </div>

          <!-- Steps with Editorial Layout -->
          @for (step of steps; track step.id; let i = $index) {
            <article
              class="step-article"
              [class]="'step-' + step.id"
              [style.--step-index]="i"
              [style.--accent]="step.accentColor"
              [style.--accent-soft]="step.accentSoft"
            >
              <!-- Large Number (Magazine Style) -->
              <div class="step-number-display">
                <span class="number-outline">0{{ step.number }}</span>
                <span class="number-fill">0{{ step.number }}</span>
                <div class="number-glow"></div>
              </div>

              <!-- Content Card -->
              <div class="step-card">
                <div class="card-shine"></div>

                <!-- Card Header -->
                <div class="card-header">
                  <div class="icon-wrapper">
                    <div class="icon-bg" [style.background]="step.iconBg">
                      @switch (step.id) {
                        @case ('plan') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="4" y="3" width="16" height="18" rx="2" stroke-linecap="round"/>
                            <path d="M8 7h8M8 11h8M8 15h5" stroke-linecap="round"/>
                            <circle cx="17" cy="15" r="2.5" fill="#22c55e" stroke="none"/>
                            <path d="M15.5 15l1 1 2-2" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        }
                        @case ('actividad') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="5" y="2" width="14" height="20" rx="3" stroke-linecap="round"/>
                            <path d="M9 2v2h6V2" stroke-linecap="round"/>
                            <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none"/>
                            <path d="M9 8h6M9 11h4" stroke-linecap="round"/>
                          </svg>
                        }
                        @case ('sesion') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="2" y="4" width="20" height="14" rx="3" stroke-linecap="round"/>
                            <polygon points="10,8 16,11 10,14" fill="currentColor" stroke="none"/>
                            <rect x="2" y="16" width="20" height="2" rx="1" fill="currentColor" opacity="0.15" stroke="none"/>
                            <circle cx="6" cy="17" r="1" fill="#efc048" stroke="none"/>
                          </svg>
                        }
                        @case ('feedback') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M8 12h.01M12 12h.01M16 12h.01" stroke-width="2.5" stroke-linecap="round"/>
                          </svg>
                        }
                      }
                    </div>
                    <div class="icon-ring"></div>
                  </div>

                  <div class="step-meta">
                    <span class="meta-label">Paso {{ step.number }}</span>
                    <div class="meta-dot"></div>
                    <span class="meta-time">{{ step.timing }}</span>
                  </div>
                </div>

                <!-- Card Body -->
                <div class="card-body">
                  <h3 class="step-title">{{ step.title }}</h3>
                  <p class="step-description">{{ step.description }}</p>

                  <!-- Feature Pills -->
                  <div class="feature-pills">
                    @for (feature of step.features; track feature; let j = $index) {
                      <span class="pill" [style.--pill-delay]="(j * 0.1) + 's'">
                        <span class="pill-dot"></span>
                        {{ feature }}
                      </span>
                    }
                  </div>
                </div>

                <!-- Card Footer Accent -->
                <div class="card-accent-bar" [style.background]="'linear-gradient(90deg, ' + step.accentColor + ', ' + step.accentSoft + ')'"></div>
              </div>

              <!-- Connector Arrow (Mobile) -->
              @if (i < steps.length - 1) {
                <div class="mobile-connector">
                  <svg viewBox="0 0 24 48" fill="none">
                    <path d="M12 0v40M6 34l6 8 6-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              }
            </article>
          }
        </div>

        <!-- Bottom CTA Section -->
        <div class="cta-section">
          <div class="cta-glass">
            <div class="cta-content">
              <div class="cta-text">
                <span class="cta-eyebrow">Empieza hoy</span>
                <h3 class="cta-headline">Tu tratamiento te espera</h3>
              </div>
              <a href="https://app.kengoapp.com/registro" class="cta-button">
                <span class="btn-bg"></span>
                <span class="btn-content">
                  <span>Comenzar ahora</span>
                  <svg class="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M5 12h14m-7-7l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </a>
            </div>
            <div class="cta-features">
              <span class="cta-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Sin tarjeta de credito
              </span>
              <span class="cta-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                Listo en 2 minutos
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ============================================
       HOW IT WORKS - Editorial Magazine Layout
       Premium Kengo Design System
    ============================================ */

    .how-it-works-section {
      position: relative;
      padding: 6rem 0 7rem;
      overflow: hidden;
      background: linear-gradient(
        175deg,
        #fffcfa 0%,
        #fff8f4 20%,
        #fff4ed 40%,
        #fff0e6 60%,
        #ffece0 80%,
        #ffe8da 100%
      );
    }

    @media (min-width: 1024px) {
      .how-it-works-section {
        padding: 8rem 0 9rem;
      }
    }

    /* ============================================
       BACKGROUND LAYERS
    ============================================ */

    .bg-layers {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .gradient-mesh {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 80% 60% at 10% 20%, rgba(231, 92, 62, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse 60% 80% at 90% 80%, rgba(239, 192, 72, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse 50% 50% at 50% 50%, rgba(247, 166, 94, 0.05) 0%, transparent 60%);
    }

    .wave-layer {
      position: absolute;
      width: 100%;
    }

    .wave-top {
      top: 0;
      left: 0;
      height: 30%;
      min-height: 180px;
    }

    .wave-bottom {
      bottom: 0;
      left: 0;
      height: 25%;
      min-height: 150px;
    }

    /* Decorative Orbs */
    .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.5;
    }

    .orb-1 {
      width: 400px;
      height: 400px;
      top: 10%;
      right: -10%;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.25) 0%, transparent 70%);
      animation: orbFloat 25s ease-in-out infinite;
    }

    .orb-2 {
      width: 350px;
      height: 350px;
      bottom: 20%;
      left: -8%;
      background: radial-gradient(circle, rgba(239, 192, 72, 0.2) 0%, transparent 70%);
      animation: orbFloat 30s ease-in-out infinite reverse;
    }

    .orb-3 {
      width: 250px;
      height: 250px;
      top: 50%;
      left: 40%;
      background: radial-gradient(circle, rgba(247, 166, 94, 0.15) 0%, transparent 70%);
      animation: orbFloat 20s ease-in-out infinite;
      animation-delay: -10s;
    }

    @keyframes orbFloat {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(-30px, 40px) scale(1.1); }
      50% { transform: translate(20px, -30px) scale(0.95); }
      75% { transform: translate(-20px, 20px) scale(1.05); }
    }

    .grain-overlay {
      position: absolute;
      inset: 0;
      opacity: 0.15;
      mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    }

    @media (max-width: 768px) {
      .orb { opacity: 0.3; }
      .orb-1 { width: 250px; height: 250px; }
      .orb-2 { width: 200px; height: 200px; }
      .orb-3 { display: none; }
    }

    /* ============================================
       CONTENT CONTAINER
    ============================================ */

    .content-container {
      position: relative;
      z-index: 1;
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    @media (min-width: 640px) {
      .content-container { padding: 0 2rem; }
    }

    @media (min-width: 1024px) {
      .content-container { padding: 0 3rem; }
    }

    /* ============================================
       EDITORIAL HEADER
    ============================================ */

    .section-header {
      text-align: center;
      max-width: 720px;
      margin: 0 auto 4rem;
    }

    @media (min-width: 1024px) {
      .section-header { margin-bottom: 5rem; }
    }

    .header-meta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 1.75rem;
      animation: fadeUp 0.6s ease-out backwards;
    }

    .meta-line {
      width: 48px;
      height: 1px;
      background: linear-gradient(90deg, transparent, #e75c3e);
    }

    .meta-line:last-child {
      background: linear-gradient(90deg, #e75c3e, transparent);
    }

    .meta-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 100px;
      font-size: 13px;
      font-weight: 700;
      color: #e75c3e;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      box-shadow:
        0 4px 20px rgba(231, 92, 62, 0.08),
        0 1px 3px rgba(0, 0, 0, 0.03);
    }

    .badge-dot {
      width: 8px;
      height: 8px;
      background: linear-gradient(135deg, #e75c3e, #f7a65e);
      border-radius: 50%;
      animation: dotPulse 2s ease-in-out infinite;
    }

    @keyframes dotPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.7; }
    }

    .section-title {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: clamp(2.25rem, 6vw, 4rem);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.02em;
      margin-bottom: 1.5rem;
    }

    .title-line {
      display: block;
      color: #1f2937;
      animation: fadeUp 0.6s ease-out 0.1s backwards;
    }

    .title-accent {
      display: block;
      background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 35%, #d97706 65%, #efc048 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      background-size: 200% auto;
      animation: fadeUp 0.6s ease-out 0.15s backwards, gradientFlow 6s ease infinite;
    }

    @keyframes gradientFlow {
      0%, 100% { background-position: 0% center; }
      50% { background-position: 100% center; }
    }

    .section-intro {
      font-size: 1.125rem;
      color: #64748b;
      line-height: 1.75;
      max-width: 540px;
      margin: 0 auto;
      animation: fadeUp 0.6s ease-out 0.2s backwards;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ============================================
       EDITORIAL TIMELINE
    ============================================ */

    .timeline-editorial {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      gap: 3.5rem;
    }

    @media (min-width: 768px) {
      .timeline-editorial {
        grid-template-columns: repeat(2, 1fr);
        gap: 2.5rem;
      }
    }

    @media (min-width: 1024px) {
      .timeline-editorial {
        grid-template-columns: repeat(4, 1fr);
        gap: 2rem;
        align-items: start;
      }
    }

    /* Flow Line (Desktop Only) */
    .flow-line-container {
      display: none;
    }

    @media (min-width: 1024px) {
      .flow-line-container {
        display: block;
        position: absolute;
        top: 120px;
        left: 5%;
        right: 5%;
        height: 100px;
        z-index: 0;
        opacity: 0.7;
      }

      .flow-line {
        width: 100%;
        height: 100%;
      }

      .flow-path {
        stroke-dasharray: 8 6;
        animation: flowDash 25s linear infinite;
      }

      @keyframes flowDash {
        to { stroke-dashoffset: -200; }
      }

      .flow-dot {
        opacity: 0.9;
      }
    }

    /* ============================================
       STEP ARTICLE
    ============================================ */

    .step-article {
      position: relative;
      z-index: 1;
      animation: stepReveal 0.7s ease-out calc(var(--step-index) * 0.12s) backwards;
    }

    @keyframes stepReveal {
      from {
        opacity: 0;
        transform: translateY(40px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Staggered Heights on Desktop */
    @media (min-width: 1024px) {
      .step-plan { transform: translateY(20px); }
      .step-actividad { transform: translateY(0); }
      .step-sesion { transform: translateY(40px); }
      .step-feedback { transform: translateY(10px); }
    }

    /* ============================================
       LARGE STEP NUMBER (Magazine Style)
    ============================================ */

    .step-number-display {
      position: relative;
      height: 80px;
      margin-bottom: -20px;
      z-index: 2;
      pointer-events: none;
    }

    .number-outline,
    .number-fill {
      position: absolute;
      left: 0;
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: 5.5rem;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .number-outline {
      color: transparent;
      -webkit-text-stroke: 2px var(--accent);
      opacity: 0.25;
      transform: translate(6px, 6px);
    }

    .number-fill {
      background: linear-gradient(180deg, var(--accent) 0%, var(--accent-soft) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .number-glow {
      position: absolute;
      top: 20px;
      left: 20px;
      width: 60px;
      height: 60px;
      background: var(--accent);
      opacity: 0.15;
      filter: blur(30px);
      border-radius: 50%;
    }

    @media (min-width: 768px) {
      .step-number-display { height: 90px; }
      .number-outline, .number-fill { font-size: 6rem; }
    }

    @media (min-width: 1024px) {
      .step-number-display { height: 100px; margin-bottom: -25px; }
      .number-outline, .number-fill { font-size: 6.5rem; }
    }

    /* ============================================
       STEP CARD
    ============================================ */

    .step-card {
      position: relative;
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 28px;
      overflow: hidden;
      box-shadow:
        0 4px 32px rgba(0, 0, 0, 0.04),
        0 1px 3px rgba(0, 0, 0, 0.02),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
      transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .step-article:hover .step-card {
      transform: translateY(-12px);
      background: rgba(255, 255, 255, 0.92);
      box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.08),
        0 8px 24px color-mix(in srgb, var(--accent) 12%, transparent),
        inset 0 1px 0 rgba(255, 255, 255, 0.9);
    }

    .card-shine {
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.4) 50%,
        transparent 100%
      );
      transition: left 0.7s ease;
      pointer-events: none;
    }

    .step-article:hover .card-shine {
      left: 100%;
    }

    /* Card Header */
    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 2rem 1.75rem 0;
    }

    .icon-wrapper {
      position: relative;
      width: 64px;
      height: 64px;
    }

    .icon-bg {
      position: relative;
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 20px;
      color: var(--accent);
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .icon-bg svg {
      width: 30px;
      height: 30px;
    }

    .step-article:hover .icon-bg {
      transform: scale(1.1) rotate(-5deg);
      box-shadow: 0 10px 28px color-mix(in srgb, var(--accent) 25%, transparent);
    }

    .icon-ring {
      position: absolute;
      inset: -8px;
      border: 1.5px dashed var(--accent);
      border-radius: 28px;
      opacity: 0.2;
      animation: ringRotate 20s linear infinite;
    }

    .step-article:hover .icon-ring {
      opacity: 0.45;
      animation-duration: 10s;
    }

    @keyframes ringRotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .step-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: rgba(0, 0, 0, 0.03);
      border-radius: 100px;
    }

    .meta-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .meta-dot {
      width: 4px;
      height: 4px;
      background: #d1d5db;
      border-radius: 50%;
    }

    .meta-time {
      font-size: 11px;
      font-weight: 500;
      color: #9ca3af;
    }

    /* Card Body */
    .card-body {
      padding: 1.5rem 1.75rem 2rem;
    }

    .step-title {
      font-family: "Galvji", system-ui, sans-serif;
      font-size: 1.375rem;
      font-weight: 800;
      color: #1a1a2e;
      letter-spacing: -0.01em;
      margin-bottom: 0.75rem;
      transition: color 0.3s ease;
    }

    .step-article:hover .step-title {
      color: var(--accent);
    }

    .step-description {
      font-size: 14px;
      color: #64748b;
      line-height: 1.7;
      margin-bottom: 1.25rem;
    }

    /* Feature Pills */
    .feature-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent-soft) 8%, transparent));
      border: 1px solid color-mix(in srgb, var(--accent) 12%, transparent);
      border-radius: 100px;
      font-size: 11px;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0;
      animation: pillFade 0.4s ease-out calc(0.4s + var(--pill-delay)) forwards;
    }

    @keyframes pillFade {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .pill-dot {
      width: 5px;
      height: 5px;
      background: linear-gradient(135deg, var(--accent), var(--accent-soft));
      border-radius: 50%;
      animation: pillDotPulse 2.5s ease-in-out infinite;
    }

    @keyframes pillDotPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Card Accent Bar */
    .card-accent-bar {
      height: 4px;
      width: 100%;
      opacity: 0.7;
      transition: opacity 0.3s ease;
    }

    .step-article:hover .card-accent-bar {
      opacity: 1;
    }

    /* ============================================
       MOBILE CONNECTOR
    ============================================ */

    .mobile-connector {
      position: absolute;
      bottom: -2.5rem;
      left: 50%;
      transform: translateX(-50%);
      width: 24px;
      height: 48px;
      color: color-mix(in srgb, var(--accent) 35%, transparent);
      animation: connectorBounce 2.5s ease-in-out infinite;
    }

    .mobile-connector svg {
      width: 100%;
      height: 100%;
    }

    @keyframes connectorBounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(8px); }
    }

    @media (min-width: 768px) {
      .mobile-connector { display: none; }
    }

    /* ============================================
       CTA SECTION
    ============================================ */

    .cta-section {
      margin-top: 4.5rem;
      animation: fadeUp 0.7s ease-out 0.5s backwards;
    }

    @media (min-width: 1024px) {
      .cta-section { margin-top: 6rem; }
    }

    .cta-glass {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2rem;
      padding: 2.5rem;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 32px;
      box-shadow:
        0 4px 40px rgba(0, 0, 0, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    @media (min-width: 768px) {
      .cta-glass {
        flex-direction: row;
        justify-content: space-between;
        padding: 2.5rem 3rem;
      }
    }

    .cta-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      text-align: center;
    }

    @media (min-width: 768px) {
      .cta-content {
        flex-direction: row;
        align-items: center;
        gap: 2rem;
        text-align: left;
      }
    }

    .cta-text {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .cta-eyebrow {
      font-size: 12px;
      font-weight: 700;
      color: #e75c3e;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .cta-headline {
      font-family: "Galvji", system-ui, sans-serif;
      font-size: 1.5rem;
      font-weight: 800;
      color: #1a1a2e;
      letter-spacing: -0.01em;
    }

    .cta-button {
      position: relative;
      display: inline-flex;
      align-items: center;
      padding: 16px 32px;
      border-radius: 16px;
      text-decoration: none;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .btn-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
      border-radius: 16px;
      transition: transform 0.4s ease;
    }

    .cta-button:hover .btn-bg {
      transform: scale(1.02);
    }

    .cta-button::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 50%);
      border-radius: 16px;
      opacity: 0;
      transition: opacity 0.4s ease;
    }

    .cta-button:hover::before {
      opacity: 1;
    }

    .cta-button:hover {
      transform: translateY(-3px);
      box-shadow:
        0 16px 40px rgba(231, 92, 62, 0.35),
        0 6px 16px rgba(231, 92, 62, 0.2);
    }

    .cta-button:active {
      transform: translateY(-1px) scale(0.98);
    }

    .btn-content {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 16px;
      font-weight: 700;
      color: white;
    }

    .btn-arrow {
      width: 20px;
      height: 20px;
      transition: transform 0.3s ease;
    }

    .cta-button:hover .btn-arrow {
      transform: translateX(4px);
    }

    .cta-features {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.25rem;
    }

    @media (min-width: 768px) {
      .cta-features {
        flex-direction: column;
        gap: 0.75rem;
      }
    }

    .cta-feature {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
    }

    .cta-feature svg {
      width: 18px;
      height: 18px;
      color: #22c55e;
    }

    /* ============================================
       REDUCED MOTION
    ============================================ */

    @media (prefers-reduced-motion: reduce) {
      .orb,
      .badge-dot,
      .title-accent,
      .icon-ring,
      .pill-dot,
      .mobile-connector,
      .flow-path,
      .flow-dot {
        animation: none !important;
      }

      .step-article,
      .step-card,
      .icon-bg,
      .cta-button,
      .card-shine,
      .pill {
        transition: none !important;
      }

      .pill {
        opacity: 1;
      }
    }
  `]
})
export class HowItWorksComponent {
  steps = [
    {
      id: 'plan',
      number: 1,
      title: 'Tu fisio crea el plan',
      description: 'Ejercicios personalizados segun tu lesion, objetivos y ritmo de vida. Todo adaptado a ti.',
      features: ['Personalizado', 'Profesional'],
      timing: '5 min',
      accentColor: '#e75c3e',
      accentSoft: '#f7a65e',
      iconBg: 'linear-gradient(135deg, rgba(231, 92, 62, 0.12) 0%, rgba(247, 166, 94, 0.06) 100%)',
    },
    {
      id: 'actividad',
      number: 2,
      title: 'Recibe tu rutina diaria',
      description: 'Cada dia sabes exactamente que ejercicios hacer. Con videos y notificaciones en tu movil.',
      features: ['Calendario', 'Alertas'],
      timing: '1 min',
      accentColor: '#f7a65e',
      accentSoft: '#ffc98b',
      iconBg: 'linear-gradient(135deg, rgba(247, 166, 94, 0.12) 0%, rgba(255, 200, 140, 0.06) 100%)',
    },
    {
      id: 'sesion',
      number: 3,
      title: 'Sesion guiada paso a paso',
      description: 'Sigue el video HD, series y descansos. Como tener a tu fisioterapeuta en casa.',
      features: ['Video HD', 'Timer'],
      timing: '15-20 min',
      accentColor: '#efc048',
      accentSoft: '#ffe082',
      iconBg: 'linear-gradient(135deg, rgba(239, 192, 72, 0.12) 0%, rgba(255, 224, 130, 0.06) 100%)',
    },
    {
      id: 'feedback',
      number: 4,
      title: 'Feedback en tiempo real',
      description: 'Registra como te sientes y tu fisio ajusta el tratamiento automaticamente.',
      features: ['Progreso', 'Ajustes'],
      timing: '30 seg',
      accentColor: '#22c55e',
      accentSoft: '#86efac',
      iconBg: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(134, 239, 172, 0.06) 100%)',
    },
  ];
}
