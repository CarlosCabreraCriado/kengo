import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-benefits',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="beneficios" class="benefits-section">
      <!-- Layered Wave Background with Morphing Blobs -->
      <div class="background-container">
        <!-- Top Morphing Wave -->
        <svg class="wave-layer wave-top" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="benefits-wave-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fff5ef" />
              <stop offset="50%" stop-color="#ffe8d6" />
              <stop offset="100%" stop-color="#fdd6b3" />
            </linearGradient>
          </defs>
          <path fill="url(#benefits-wave-1)" fill-opacity="0.55">
            <animate
              attributeName="d"
              dur="20s"
              repeatCount="indefinite"
              values="
                M0,128 C180,200 360,60 540,140 C720,220 900,100 1080,160 C1260,220 1440,100 1440,100 L1440,0 L0,0 Z;
                M0,100 C180,40 360,180 540,100 C720,20 900,180 1080,100 C1260,20 1440,140 1440,140 L1440,0 L0,0 Z;
                M0,140 C180,80 360,200 540,120 C720,40 900,160 1080,80 C1260,0 1440,120 1440,120 L1440,0 L0,0 Z;
                M0,128 C180,200 360,60 540,140 C720,220 900,100 1080,160 C1260,220 1440,100 1440,100 L1440,0 L0,0 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>

        <!-- Bottom Wave -->
        <svg class="wave-layer wave-bottom" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="benefits-wave-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fdd6b3" />
              <stop offset="50%" stop-color="#f7a65e" stop-opacity="0.2" />
              <stop offset="100%" stop-color="#ffedd6" />
            </linearGradient>
          </defs>
          <path fill="url(#benefits-wave-2)" fill-opacity="0.4">
            <animate
              attributeName="d"
              dur="25s"
              repeatCount="indefinite"
              values="
                M0,180 C320,100 640,260 960,180 C1280,100 1440,220 1440,220 L1440,320 L0,320 Z;
                M0,220 C320,300 640,140 960,220 C1280,300 1440,180 1440,180 L1440,320 L0,320 Z;
                M0,200 C320,120 640,280 960,200 C1280,120 1440,240 1440,240 L1440,320 L0,320 Z;
                M0,180 C320,100 640,260 960,180 C1280,100 1440,220 1440,220 L1440,320 L0,320 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
          <path fill="#e75c3e" fill-opacity="0.05">
            <animate
              attributeName="d"
              dur="30s"
              repeatCount="indefinite"
              values="
                M0,240 C400,160 800,320 1200,240 C1320,200 1440,280 1440,280 L1440,320 L0,320 Z;
                M0,200 C400,280 800,120 1200,200 C1320,240 1440,160 1440,160 L1440,320 L0,320 Z;
                M0,260 C400,180 800,340 1200,260 C1320,220 1440,300 1440,300 L1440,320 L0,320 Z;
                M0,240 C400,160 800,320 1200,240 C1320,200 1440,280 1440,280 L1440,320 L0,320 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>

        <!-- Floating Morphing Blobs -->
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="blob blob-3"></div>

        <!-- Grain Overlay -->
        <div class="grain-texture"></div>
      </div>

      <!-- Content -->
      <div class="content-wrapper">
        <!-- Section Header -->
        <header class="section-header">
          <div class="badge-row">
            <span class="header-line"></span>
            <span class="header-badge">
              <span class="badge-pulse"></span>
              Para cada rol
            </span>
            <span class="header-line"></span>
          </div>

          <h2 class="section-title">
            Una plataforma,
            <br />
            <span class="title-accent">tres experiencias</span>
          </h2>

          <p class="section-subtitle">
            Cada usuario encuentra exactamente lo que necesita.
            Herramientas especializadas que transforman la rehabilitacion.
          </p>
        </header>

        <!-- Ecosystem Cards Layout -->
        <div class="ecosystem-grid">
          <!-- Connection Flow Lines (Desktop) -->
          <div class="flow-connections">
            <svg class="flow-svg" viewBox="0 0 1200 600" preserveAspectRatio="none">
              <defs>
                <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#e75c3e" stop-opacity="0.3" />
                  <stop offset="50%" stop-color="#efc048" stop-opacity="0.5" />
                  <stop offset="100%" stop-color="#6366f1" stop-opacity="0.3" />
                </linearGradient>
                <filter id="glow-filter">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                class="flow-path"
                d="M100,300 C200,200 350,400 500,300 C650,200 750,400 900,300 C1000,220 1100,300 1100,300"
                fill="none"
                stroke="url(#flow-gradient)"
                stroke-width="3"
                filter="url(#glow-filter)"
              />
              <circle class="flow-particle particle-1" r="6" fill="#e75c3e">
                <animateMotion dur="8s" repeatCount="indefinite">
                  <mpath href="#flow-path-motion" />
                </animateMotion>
              </circle>
              <circle class="flow-particle particle-2" r="4" fill="#efc048">
                <animateMotion dur="8s" repeatCount="indefinite" begin="-3s">
                  <mpath href="#flow-path-motion" />
                </animateMotion>
              </circle>
              <circle class="flow-particle particle-3" r="5" fill="#6366f1">
                <animateMotion dur="8s" repeatCount="indefinite" begin="-5s">
                  <mpath href="#flow-path-motion" />
                </animateMotion>
              </circle>
              <path
                id="flow-path-motion"
                d="M100,300 C200,200 350,400 500,300 C650,200 750,400 900,300 C1000,220 1100,300 1100,300"
                fill="none"
                stroke="none"
              />
            </svg>
          </div>

          @for (segment of segments; track segment.id; let i = $index) {
            <article
              class="segment-card"
              [class]="'segment-' + segment.id"
              [style.--card-index]="i"
              [style.--accent]="segment.accentColor"
              [style.--accent-light]="segment.accentLight"
            >
              <!-- Card Background Layers -->
              <div class="card-bg-layer">
                <div class="card-morphing-bg" [style.background]="segment.morphBg"></div>
              </div>

              <!-- Glowing Border on Hover -->
              <div class="card-glow-border"></div>

              <!-- Card Content -->
              <div class="card-body">
                <!-- Header Row -->
                <div class="card-header-row">
                  <!-- Animated Icon -->
                  <div class="icon-container">
                    <div class="icon-rings">
                      <div class="ring ring-1"></div>
                      <div class="ring ring-2"></div>
                    </div>
                    <div class="icon-shape" [style.background]="segment.iconBg">
                      @switch (segment.id) {
                        @case ('pacientes') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-linecap="round"/>
                            <circle cx="12" cy="7" r="4"/>
                            <path d="M12 11v3m-1.5-1.5h3" stroke-linecap="round" stroke-width="2"/>
                          </svg>
                        }
                        @case ('fisioterapeutas') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="5" r="3"/>
                            <path d="M12 8v5m-4 2h8M8 15l2 6m6-6l-2 6" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="18" cy="4" r="2" fill="currentColor" opacity="0.3"/>
                          </svg>
                        }
                        @case ('clinicas') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="4" y="6" width="16" height="14" rx="2"/>
                            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke-linecap="round"/>
                            <path d="M12 10v6m-3-3h6" stroke-linecap="round" stroke-width="2"/>
                          </svg>
                        }
                      }
                    </div>
                  </div>

                  <!-- Tier Badge -->
                  <div class="tier-badge" [style.--badge-bg]="segment.tagBg" [style.--badge-color]="segment.tagColor">
                    <span class="badge-indicator"></span>
                    <span class="badge-text">{{ segment.tag }}</span>
                  </div>
                </div>

                <!-- Title & Description -->
                <h3 class="card-title">{{ segment.title }}</h3>
                <p class="card-description">{{ segment.description }}</p>

                <!-- Elegant Divider -->
                <div class="card-divider">
                  <span class="divider-wing left"></span>
                  <span class="divider-diamond">
                    <svg viewBox="0 0 12 12" fill="currentColor">
                      <path d="M6 0L12 6L6 12L0 6Z"/>
                    </svg>
                  </span>
                  <span class="divider-wing right"></span>
                </div>

                <!-- Benefits List -->
                <ul class="benefits-list">
                  @for (benefit of segment.benefits; track benefit.text; let j = $index) {
                    <li class="benefit-row" [style.--row-index]="j">
                      <span class="benefit-check">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                          <path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </span>
                      <span class="benefit-label">{{ benefit.text }}</span>
                      @if (benefit.highlight) {
                        <span class="benefit-tag">{{ benefit.highlight }}</span>
                      }
                    </li>
                  }
                </ul>

                <!-- CTA Button -->
                <a [href]="segment.ctaLink" class="card-cta">
                  <span class="cta-shine"></span>
                  <span class="cta-label">{{ segment.cta }}</span>
                  <span class="cta-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                </a>
              </div>

              <!-- Decorative Corner Accent -->
              <div class="corner-accent"></div>

              <!-- Floating Decorative Elements -->
              <div class="card-floaters">
                <div class="floater floater-1"></div>
                <div class="floater floater-2"></div>
              </div>
            </article>
          }
        </div>

        <!-- Stats Showcase -->
        <div class="stats-showcase">
          <div class="stats-glass">
            <div class="stat-block">
              <span class="stat-value">+1.000</span>
              <span class="stat-label">pacientes activos</span>
            </div>
            <div class="stat-separator"></div>
            <div class="stat-block">
              <span class="stat-value">+500</span>
              <span class="stat-label">ejercicios HD</span>
            </div>
            <div class="stat-separator"></div>
            <div class="stat-block">
              <span class="stat-value">4.9</span>
              <span class="stat-label">valoracion media</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ============================================
       BENEFITS SECTION - Kengo Ecosystem Design
       Premium Glassmorphism + Editorial Layout
    ============================================ */

    .benefits-section {
      position: relative;
      padding: 7rem 0 8rem;
      overflow: hidden;
      background: linear-gradient(
        175deg,
        #fffbf8 0%,
        #fff7f2 25%,
        #fff3eb 50%,
        #ffefe4 75%,
        #ffebdd 100%
      );
    }

    @media (min-width: 1024px) {
      .benefits-section {
        padding: 9rem 0 10rem;
      }
    }

    /* ============================================
       BACKGROUND LAYERS
    ============================================ */

    .background-container {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .wave-layer {
      position: absolute;
      width: 100%;
      height: auto;
    }

    .wave-top {
      top: 0;
      left: 0;
      height: 35%;
      min-height: 200px;
    }

    .wave-bottom {
      bottom: 0;
      left: 0;
      height: 30%;
      min-height: 180px;
    }

    /* Morphing Blobs */
    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.4;
      mix-blend-mode: multiply;
    }

    .blob-1 {
      width: 500px;
      height: 500px;
      top: 5%;
      right: -10%;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.4) 0%, transparent 70%);
      animation: blobMorph1 25s ease-in-out infinite;
    }

    .blob-2 {
      width: 400px;
      height: 400px;
      bottom: 15%;
      left: -8%;
      background: radial-gradient(circle, rgba(239, 192, 72, 0.35) 0%, transparent 70%);
      animation: blobMorph2 30s ease-in-out infinite;
    }

    .blob-3 {
      width: 350px;
      height: 350px;
      top: 40%;
      left: 35%;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);
      animation: blobMorph3 20s ease-in-out infinite;
    }

    @keyframes blobMorph1 {
      0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); border-radius: 50%; }
      25% { transform: translate(-40px, 60px) scale(1.1) rotate(90deg); border-radius: 40% 60% 70% 30%; }
      50% { transform: translate(30px, -40px) scale(0.95) rotate(180deg); border-radius: 60% 40% 30% 70%; }
      75% { transform: translate(-20px, 30px) scale(1.05) rotate(270deg); border-radius: 30% 70% 60% 40%; }
    }

    @keyframes blobMorph2 {
      0%, 100% { transform: translate(0, 0) scale(1); border-radius: 50%; }
      33% { transform: translate(50px, -30px) scale(1.15); border-radius: 70% 30% 50% 50%; }
      66% { transform: translate(-30px, 50px) scale(0.9); border-radius: 30% 70% 70% 30%; }
    }

    @keyframes blobMorph3 {
      0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
      50% { transform: translate(-60px, 40px) scale(1.2); opacity: 0.6; }
    }

    /* Grain Texture */
    .grain-texture {
      position: absolute;
      inset: 0;
      opacity: 0.18;
      mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }

    @media (max-width: 768px) {
      .blob { opacity: 0.25; }
      .blob-1 { width: 300px; height: 300px; }
      .blob-2 { width: 250px; height: 250px; }
      .blob-3 { display: none; }
    }

    /* ============================================
       CONTENT WRAPPER
    ============================================ */

    .content-wrapper {
      position: relative;
      z-index: 1;
      max-width: 1320px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    @media (min-width: 640px) {
      .content-wrapper { padding: 0 2rem; }
    }

    @media (min-width: 1024px) {
      .content-wrapper { padding: 0 3rem; }
    }

    /* ============================================
       SECTION HEADER
    ============================================ */

    .section-header {
      text-align: center;
      max-width: 800px;
      margin: 0 auto 4.5rem;
    }

    @media (min-width: 1024px) {
      .section-header { margin-bottom: 5.5rem; }
    }

    .badge-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 2rem;
      animation: fadeSlideUp 0.7s ease-out backwards;
    }

    .header-line {
      width: 48px;
      height: 1px;
      background: linear-gradient(90deg, transparent, #e75c3e);
    }

    .header-line:last-child {
      background: linear-gradient(90deg, #e75c3e, transparent);
    }

    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 22px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 100px;
      font-size: 14px;
      font-weight: 700;
      color: #e75c3e;
      letter-spacing: 0.03em;
      box-shadow:
        0 4px 20px rgba(231, 92, 62, 0.08),
        0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .badge-pulse {
      width: 8px;
      height: 8px;
      background: linear-gradient(135deg, #e75c3e, #f7a65e);
      border-radius: 50%;
      animation: badgePulse 2.5s ease-in-out infinite;
    }

    @keyframes badgePulse {
      0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(231, 92, 62, 0.4); }
      50% { transform: scale(1.1); opacity: 0.8; box-shadow: 0 0 0 6px rgba(231, 92, 62, 0); }
    }

    .section-title {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: clamp(2.25rem, 6vw, 3.75rem);
      font-weight: 700;
      color: #1f2937;
      line-height: 1.1;
      letter-spacing: -0.02em;
      margin-bottom: 1.5rem;
      animation: fadeSlideUp 0.7s ease-out 0.1s backwards;
    }

    .title-accent {
      background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 40%, #d97706 70%, #efc048 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      background-size: 200% auto;
      animation: gradientShift 8s ease infinite;
    }

    @keyframes gradientShift {
      0%, 100% { background-position: 0% center; }
      50% { background-position: 100% center; }
    }

    .section-subtitle {
      font-size: 1.125rem;
      color: #6b7280;
      line-height: 1.75;
      max-width: 600px;
      margin: 0 auto;
      animation: fadeSlideUp 0.7s ease-out 0.2s backwards;
    }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ============================================
       ECOSYSTEM GRID - Editorial Layout
    ============================================ */

    .ecosystem-grid {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    @media (min-width: 768px) {
      .ecosystem-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 2rem;
      }

      .segment-clinicas {
        grid-column: span 2;
        max-width: 560px;
        justify-self: center;
      }
    }

    @media (min-width: 1024px) {
      .ecosystem-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 2.5rem;
        align-items: start;
      }

      .segment-pacientes {
        transform: translateY(30px);
      }

      .segment-fisioterapeutas {
        transform: translateY(-10px);
      }

      .segment-clinicas {
        grid-column: span 1;
        max-width: none;
        transform: translateY(50px);
      }
    }

    /* Flow Connections (Desktop only) */
    .flow-connections {
      display: none;
    }

    @media (min-width: 1024px) {
      .flow-connections {
        display: block;
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 200px;
        transform: translateY(-50%);
        pointer-events: none;
        z-index: 0;
        opacity: 0.6;
      }

      .flow-svg {
        width: 100%;
        height: 100%;
      }

      .flow-path {
        stroke-dasharray: 8 4;
        animation: flowDash 20s linear infinite;
      }

      @keyframes flowDash {
        to { stroke-dashoffset: -100; }
      }

      .flow-particle {
        opacity: 0.8;
        filter: blur(1px);
      }
    }

    /* ============================================
       SEGMENT CARD
    ============================================ */

    .segment-card {
      position: relative;
      border-radius: 32px;
      animation: cardReveal 0.6s ease-out calc(var(--card-index) * 0.15s) backwards;
      transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }

    @keyframes cardReveal {
      from {
        opacity: 0;
        transform: translateY(40px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .segment-card:hover {
      transform: translateY(-14px) scale(1.02);
    }

    @media (min-width: 1024px) {
      .segment-pacientes:hover { transform: translateY(16px) scale(1.02); }
      .segment-fisioterapeutas:hover { transform: translateY(-24px) scale(1.02); }
      .segment-clinicas:hover { transform: translateY(36px) scale(1.02); }
    }

    /* Card Background Layer */
    .card-bg-layer {
      position: absolute;
      inset: 0;
      border-radius: 32px;
      overflow: hidden;
    }

    .card-morphing-bg {
      position: absolute;
      inset: -50%;
      width: 200%;
      height: 200%;
      opacity: 0.15;
      animation: cardBgRotate 30s linear infinite;
    }

    @keyframes cardBgRotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Glow Border */
    .card-glow-border {
      position: absolute;
      inset: 0;
      border-radius: 32px;
      padding: 2px;
      background: linear-gradient(135deg, var(--accent) 0%, transparent 40%, transparent 60%, var(--accent) 100%);
      opacity: 0;
      transition: opacity 0.5s ease;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }

    .segment-card:hover .card-glow-border {
      opacity: 1;
    }

    /* Card Body */
    .card-body {
      position: relative;
      padding: 2.5rem;
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 32px;
      box-shadow:
        0 4px 32px rgba(0, 0, 0, 0.04),
        0 1px 3px rgba(0, 0, 0, 0.02),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
      transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .segment-card:hover .card-body {
      background: rgba(255, 255, 255, 0.92);
      box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.08),
        0 8px 24px color-mix(in srgb, var(--accent) 15%, transparent),
        inset 0 1px 0 rgba(255, 255, 255, 0.9);
    }

    @media (max-width: 640px) {
      .card-body { padding: 2rem 1.75rem; }
    }

    /* ============================================
       CARD HEADER ROW
    ============================================ */

    .card-header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1.75rem;
    }

    /* Icon Container */
    .icon-container {
      position: relative;
      width: 76px;
      height: 76px;
    }

    .icon-rings {
      position: absolute;
      inset: -12px;
    }

    .ring {
      position: absolute;
      inset: 0;
      border: 1.5px dashed var(--accent);
      border-radius: 50%;
      opacity: 0.25;
    }

    .ring-1 {
      animation: ringRotate 20s linear infinite;
    }

    .ring-2 {
      inset: 6px;
      animation: ringRotate 15s linear infinite reverse;
      opacity: 0.15;
    }

    @keyframes ringRotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .segment-card:hover .ring {
      opacity: 0.5;
      animation-duration: 8s;
    }

    .icon-shape {
      position: relative;
      width: 76px;
      height: 76px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 24px;
      color: var(--accent);
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .icon-shape svg {
      width: 34px;
      height: 34px;
    }

    .segment-card:hover .icon-shape {
      transform: scale(1.1) rotate(-6deg);
      box-shadow: 0 12px 32px color-mix(in srgb, var(--accent) 30%, transparent);
    }

    /* Tier Badge */
    .tier-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: var(--badge-bg);
      color: var(--badge-color);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-radius: 100px;
    }

    .badge-indicator {
      width: 6px;
      height: 6px;
      background: var(--badge-color);
      border-radius: 50%;
      animation: indicatorPulse 2s ease-in-out infinite;
    }

    @keyframes indicatorPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(0.7); opacity: 0.5; }
    }

    /* ============================================
       CARD CONTENT
    ============================================ */

    .card-title {
      font-family: "Galvji", system-ui, sans-serif;
      font-size: 1.625rem;
      font-weight: 800;
      color: #1a1a2e;
      letter-spacing: -0.02em;
      margin-bottom: 0.75rem;
      transition: color 0.3s ease;
    }

    .segment-card:hover .card-title {
      color: var(--accent);
    }

    .card-description {
      font-size: 15px;
      color: #64748b;
      line-height: 1.7;
      margin-bottom: 1.75rem;
    }

    /* Elegant Divider */
    .card-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 1.75rem;
    }

    .divider-wing {
      flex: 1;
      height: 1px;
    }

    .divider-wing.left {
      background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.08));
    }

    .divider-wing.right {
      background: linear-gradient(90deg, rgba(0, 0, 0, 0.08), transparent);
    }

    .divider-diamond {
      width: 12px;
      height: 12px;
      color: #d1d5db;
      transition: all 0.3s ease;
    }

    .segment-card:hover .divider-diamond {
      color: var(--accent);
      transform: rotate(45deg) scale(1.2);
    }

    .divider-diamond svg {
      width: 100%;
      height: 100%;
    }

    /* ============================================
       BENEFITS LIST
    ============================================ */

    .benefits-list {
      list-style: none;
      padding: 0;
      margin: 0 0 2rem;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .benefit-row {
      display: flex;
      align-items: center;
      gap: 14px;
      opacity: 0;
      animation: benefitSlide 0.4s ease-out calc(0.3s + var(--row-index) * 0.08s) forwards;
    }

    @keyframes benefitSlide {
      from { opacity: 0; transform: translateX(-12px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .benefit-check {
      flex-shrink: 0;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 80%, #000));
      border-radius: 8px;
      color: white;
      box-shadow: 0 3px 10px color-mix(in srgb, var(--accent) 35%, transparent);
      transition: all 0.3s ease;
    }

    .benefit-check svg {
      width: 12px;
      height: 12px;
    }

    .segment-card:hover .benefit-check {
      transform: scale(1.1);
    }

    .benefit-label {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      line-height: 1.5;
    }

    .benefit-tag {
      padding: 5px 10px;
      background: linear-gradient(135deg, var(--accent-light), color-mix(in srgb, var(--accent-light) 60%, transparent));
      color: var(--accent);
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 6px;
    }

    /* ============================================
       CTA BUTTON
    ============================================ */

    .card-cta {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 16px 28px;
      background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 85%, #000));
      color: white;
      font-size: 15px;
      font-weight: 700;
      border-radius: 16px;
      text-decoration: none;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      box-shadow: 0 4px 20px color-mix(in srgb, var(--accent) 35%, transparent);
    }

    .cta-shine {
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
      transition: left 0.6s ease;
    }

    .card-cta:hover .cta-shine {
      left: 100%;
    }

    .card-cta:hover {
      transform: translateX(6px);
      box-shadow: 0 8px 32px color-mix(in srgb, var(--accent) 45%, transparent);
    }

    .cta-label {
      position: relative;
      z-index: 1;
    }

    .cta-icon {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      transition: transform 0.3s ease;
    }

    .cta-icon svg {
      width: 18px;
      height: 18px;
    }

    .card-cta:hover .cta-icon {
      transform: translateX(4px);
    }

    /* ============================================
       DECORATIVE ELEMENTS
    ============================================ */

    .corner-accent {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 140px;
      height: 140px;
      background: radial-gradient(circle at 100% 100%, var(--accent-light) 0%, transparent 70%);
      border-radius: 0 0 32px 0;
      pointer-events: none;
      opacity: 0.5;
      transition: opacity 0.3s ease;
    }

    .segment-card:hover .corner-accent {
      opacity: 0.8;
    }

    .card-floaters {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      border-radius: 32px;
    }

    .floater {
      position: absolute;
      border-radius: 50%;
      opacity: 0;
      transition: opacity 0.5s ease;
    }

    .segment-card:hover .floater {
      opacity: 1;
    }

    .floater-1 {
      width: 60px;
      height: 60px;
      top: 15%;
      right: 8%;
      background: radial-gradient(circle, var(--accent-light), transparent 70%);
      animation: floaterDrift 6s ease-in-out infinite;
    }

    .floater-2 {
      width: 40px;
      height: 40px;
      bottom: 25%;
      left: 5%;
      background: radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent), transparent 70%);
      animation: floaterDrift 8s ease-in-out infinite reverse;
    }

    @keyframes floaterDrift {
      0%, 100% { transform: translate(0, 0); }
      50% { transform: translate(-10px, 15px); }
    }

    /* ============================================
       STATS SHOWCASE
    ============================================ */

    .stats-showcase {
      margin-top: 4.5rem;
      animation: fadeSlideUp 0.7s ease-out 0.5s backwards;
    }

    @media (min-width: 1024px) {
      .stats-showcase { margin-top: 5.5rem; }
    }

    .stats-glass {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 2rem;
      padding: 2.25rem 3rem;
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.65);
      border-radius: 28px;
      box-shadow:
        0 4px 32px rgba(0, 0, 0, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }

    @media (min-width: 640px) {
      .stats-glass { gap: 3.5rem; }
    }

    .stat-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .stat-value {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #e75c3e 0%, #d97706 50%, #efc048 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .stat-label {
      font-size: 14px;
      font-weight: 500;
      color: #6b7280;
    }

    .stat-separator {
      width: 1px;
      height: 48px;
      background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.1), transparent);
    }

    @media (max-width: 639px) {
      .stat-separator { display: none; }
      .stats-glass {
        gap: 2rem;
        padding: 2rem;
      }
      .stat-block {
        flex: 1;
        min-width: 100px;
      }
    }

    /* ============================================
       REDUCED MOTION
    ============================================ */

    @media (prefers-reduced-motion: reduce) {
      .blob,
      .badge-pulse,
      .title-accent,
      .ring,
      .card-morphing-bg,
      .floater,
      .flow-path,
      .flow-particle,
      .indicator-pulse,
      .benefit-row {
        animation: none !important;
      }

      .segment-card,
      .icon-shape,
      .card-cta,
      .card-body,
      .divider-diamond,
      .benefit-check,
      .cta-shine {
        transition: none !important;
      }

      .benefit-row { opacity: 1; }
      .segment-card { transform: none !important; }
    }
  `]
})
export class BenefitsComponent {
  segments = [
    {
      id: 'pacientes',
      title: 'Para Pacientes',
      tag: 'Gratis',
      tagBg: 'rgba(34, 197, 94, 0.12)',
      tagColor: '#16a34a',
      accentColor: '#e75c3e',
      accentLight: 'rgba(231, 92, 62, 0.12)',
      iconBg: 'linear-gradient(135deg, rgba(231, 92, 62, 0.14) 0%, rgba(255, 200, 180, 0.06) 100%)',
      morphBg: 'conic-gradient(from 0deg, rgba(231, 92, 62, 0.3) 0deg, rgba(247, 166, 94, 0.2) 120deg, rgba(255, 200, 180, 0.3) 240deg, rgba(231, 92, 62, 0.3) 360deg)',
      cta: 'Empezar ahora',
      ctaLink: 'https://app.kengoapp.com/registro',
      description: 'Tu fisio siempre contigo. Ejercicios guiados con video, seguimiento del dolor y comunicacion directa.',
      benefits: [
        { text: 'Ejercicios con video HD profesional', highlight: null },
        { text: 'Sabe exactamente que hacer cada dia', highlight: null },
        { text: 'Registra como te sientes', highlight: 'Nuevo' },
        { text: 'Tu fisio siempre informado', highlight: null },
      ],
    },
    {
      id: 'fisioterapeutas',
      title: 'Para Fisioterapeutas',
      tag: 'Pro',
      tagBg: 'rgba(217, 119, 6, 0.12)',
      tagColor: '#d97706',
      accentColor: '#d97706',
      accentLight: 'rgba(217, 119, 6, 0.12)',
      iconBg: 'linear-gradient(135deg, rgba(239, 192, 72, 0.18) 0%, rgba(255, 220, 150, 0.06) 100%)',
      morphBg: 'conic-gradient(from 90deg, rgba(217, 119, 6, 0.3) 0deg, rgba(239, 192, 72, 0.3) 120deg, rgba(255, 200, 100, 0.2) 240deg, rgba(217, 119, 6, 0.3) 360deg)',
      cta: 'Crear cuenta',
      ctaLink: 'https://app.kengoapp.com/registro',
      description: 'Herramientas profesionales para crear planes, gestionar pacientes y monitorizar adherencia en tiempo real.',
      benefits: [
        { text: 'Crea planes en minutos, no horas', highlight: null },
        { text: '+500 ejercicios en el catalogo', highlight: 'HD' },
        { text: 'Monitoriza adherencia real', highlight: null },
        { text: 'Plantillas reutilizables', highlight: null },
      ],
    },
    {
      id: 'clinicas',
      title: 'Para Clinicas',
      tag: 'Enterprise',
      tagBg: 'rgba(99, 102, 241, 0.12)',
      tagColor: '#6366f1',
      accentColor: '#6366f1',
      accentLight: 'rgba(99, 102, 241, 0.12)',
      iconBg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, rgba(165, 180, 252, 0.06) 100%)',
      morphBg: 'conic-gradient(from 180deg, rgba(99, 102, 241, 0.3) 0deg, rgba(139, 92, 246, 0.2) 120deg, rgba(165, 180, 252, 0.3) 240deg, rgba(99, 102, 241, 0.3) 360deg)',
      cta: 'Contactar ventas',
      ctaLink: 'https://app.kengoapp.com/registro',
      description: 'Escala tu clinica con gestion centralizada del equipo, codigos de acceso seguros y branding personalizado.',
      benefits: [
        { text: 'Gestion centralizada del equipo', highlight: null },
        { text: 'Codigos de acceso seguros', highlight: null },
        { text: 'Tu marca, tu identidad', highlight: 'Branding' },
        { text: 'Escala sin complicaciones', highlight: null },
      ],
    },
  ];
}
