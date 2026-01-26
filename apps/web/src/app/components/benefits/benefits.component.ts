import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-benefits',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="beneficios" class="benefits-section relative py-28 lg:py-40 overflow-hidden">
      <!-- Animated Wave Background -->
      <div class="waves-container">
        <!-- Top Waves -->
        <svg class="wave wave-top" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="wave-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fff5ef" />
              <stop offset="50%" stop-color="#ffe8d6" />
              <stop offset="100%" stop-color="#fdd6b3" />
            </linearGradient>
          </defs>
          <path class="wave-path wave-path-1" fill="url(#wave-gradient-1)" fill-opacity="0.6">
            <animate
              attributeName="d"
              dur="25s"
              repeatCount="indefinite"
              values="
                M0,160 C320,220 640,100 960,180 C1280,260 1440,140 1440,140 L1440,0 L0,0 Z;
                M0,140 C320,80 640,200 960,120 C1280,40 1440,180 1440,180 L1440,0 L0,0 Z;
                M0,180 C320,120 640,240 960,160 C1280,80 1440,200 1440,200 L1440,0 L0,0 Z;
                M0,160 C320,220 640,100 960,180 C1280,260 1440,140 1440,140 L1440,0 L0,0 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
          <path class="wave-path wave-path-2" fill="#fdd6b3" fill-opacity="0.4">
            <animate
              attributeName="d"
              dur="20s"
              repeatCount="indefinite"
              values="
                M0,100 C360,180 720,60 1080,140 C1260,180 1440,100 1440,100 L1440,0 L0,0 Z;
                M0,140 C360,60 720,180 1080,100 C1260,140 1440,180 1440,180 L1440,0 L0,0 Z;
                M0,80 C360,160 720,40 1080,120 C1260,160 1440,80 1440,80 L1440,0 L0,0 Z;
                M0,100 C360,180 720,60 1080,140 C1260,180 1440,100 1440,100 L1440,0 L0,0 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>

        <!-- Bottom Waves -->
        <svg class="wave wave-bottom" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="wave-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fdd6b3" />
              <stop offset="50%" stop-color="#f7a65e" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#ffedd6" />
            </linearGradient>
          </defs>
          <path class="wave-path wave-path-3" fill="url(#wave-gradient-2)" fill-opacity="0.5">
            <animate
              attributeName="d"
              dur="22s"
              repeatCount="indefinite"
              values="
                M0,160 C240,80 480,240 720,160 C960,80 1200,200 1440,160 L1440,320 L0,320 Z;
                M0,200 C240,280 480,120 720,200 C960,280 1200,100 1440,200 L1440,320 L0,320 Z;
                M0,180 C240,100 480,260 720,180 C960,100 1200,220 1440,180 L1440,320 L0,320 Z;
                M0,160 C240,80 480,240 720,160 C960,80 1200,200 1440,160 L1440,320 L0,320 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
          <path class="wave-path wave-path-4" fill="#e75c3e" fill-opacity="0.08">
            <animate
              attributeName="d"
              dur="28s"
              repeatCount="indefinite"
              values="
                M0,220 C360,140 720,280 1080,200 C1260,160 1440,240 1440,240 L1440,320 L0,320 Z;
                M0,180 C360,260 720,140 1080,220 C1260,260 1440,180 1440,180 L1440,320 L0,320 Z;
                M0,240 C360,160 720,300 1080,220 C1260,180 1440,260 1440,260 L1440,320 L0,320 Z;
                M0,220 C360,140 720,280 1080,200 C1260,160 1440,240 1440,240 L1440,320 L0,320 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>

        <!-- Side Accent Waves -->
        <svg class="wave wave-side-left" viewBox="0 0 200 800" preserveAspectRatio="none">
          <path fill="#efc048" fill-opacity="0.12">
            <animate
              attributeName="d"
              dur="18s"
              repeatCount="indefinite"
              values="
                M0,0 Q100,200 50,400 Q0,600 80,800 L0,800 L0,0 Z;
                M0,0 Q80,150 30,350 Q-20,550 60,800 L0,800 L0,0 Z;
                M0,0 Q120,250 70,450 Q20,650 100,800 L0,800 L0,0 Z;
                M0,0 Q100,200 50,400 Q0,600 80,800 L0,800 L0,0 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>

        <svg class="wave wave-side-right" viewBox="0 0 200 800" preserveAspectRatio="none">
          <path fill="#e75c3e" fill-opacity="0.08">
            <animate
              attributeName="d"
              dur="20s"
              repeatCount="indefinite"
              values="
                M200,0 Q100,200 150,400 Q200,600 120,800 L200,800 L200,0 Z;
                M200,0 Q120,150 170,350 Q220,550 140,800 L200,800 L200,0 Z;
                M200,0 Q80,250 130,450 Q180,650 100,800 L200,800 L200,0 Z;
                M200,0 Q100,200 150,400 Q200,600 120,800 L200,800 L200,0 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>
      </div>

      <!-- Grain Texture Overlay -->
      <div class="grain-overlay"></div>

      <!-- Floating Decorative Dots -->
      <div class="floating-elements">
        <div class="floating-dot dot-1"></div>
        <div class="floating-dot dot-2"></div>
        <div class="floating-dot dot-3"></div>
      </div>

      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center max-w-4xl mx-auto mb-20 lg:mb-28">
          <div class="animate-in inline-flex items-center gap-3 mb-8">
            <span class="h-px w-12 bg-gradient-to-r from-transparent to-primary"></span>
            <span class="px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-white/50 text-primary text-sm font-semibold tracking-wide shadow-lg shadow-primary/5">
              Para cada rol
            </span>
            <span class="h-px w-12 bg-gradient-to-l from-transparent to-primary"></span>
          </div>

          <h2 class="animate-in delay-100 text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-8">
            Una plataforma,
            <br />
            <span class="title-gradient">tres experiencias</span>
          </h2>

          <p class="animate-in delay-200 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
            Cada usuario encuentra exactamente lo que necesita.
            Herramientas especializadas que transforman la rehabilitacion.
          </p>
        </div>

        <!-- Benefits Cards - Asymmetric Layout -->
        <div class="cards-container">
          @for (segment of segments; track segment.id; let i = $index) {
            <div
              class="animate-in benefit-card"
              [class]="'card-' + segment.id"
              [style.animation-delay]="(i * 0.2) + 's'"
            >
              <!-- Glowing Border Effect -->
              <div class="card-border-glow" [style.--glow-color]="segment.glowColor"></div>

              <!-- Card Inner -->
              <div class="card-inner">
                <!-- Header with Icon and Tag -->
                <div class="card-header">
                  <!-- Animated Icon Container -->
                  <div class="icon-orbit" [style.--accent-color]="segment.accentColor">
                    <div class="orbit-ring"></div>
                    <div class="icon-core" [style.background]="segment.iconBg">
                      @switch (segment.id) {
                        @case ('pacientes') {
                          <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M5 20v-2a7 7 0 0 1 14 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <path d="M12 14v4m-2-2h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                          </svg>
                        }
                        @case ('fisioterapeutas') {
                          <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M12 9v6m0 0l-3 4m3-4l3 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M8 13h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <circle cx="19" cy="5" r="2" fill="currentColor" opacity="0.3"/>
                          </svg>
                        }
                        @case ('clinicas') {
                          <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="8" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M12 8V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M12 12v4m-2-2h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <circle cx="12" cy="14" r="3" stroke="currentColor" stroke-width="1" opacity="0.3"/>
                          </svg>
                        }
                      }
                    </div>
                  </div>

                  <!-- Tag Badge -->
                  <div class="tag-badge" [style.--tag-bg]="segment.tagBg" [style.--tag-color]="segment.tagColor">
                    <span class="tag-dot"></span>
                    {{ segment.tag }}
                  </div>
                </div>

                <!-- Title -->
                <h3 class="card-title">{{ segment.title }}</h3>

                <!-- Description -->
                <p class="card-description">{{ segment.description }}</p>

                <!-- Divider -->
                <div class="card-divider">
                  <span class="divider-line"></span>
                  <span class="divider-icon">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <span class="divider-line"></span>
                </div>

                <!-- Benefits List -->
                <ul class="benefits-list">
                  @for (benefit of segment.benefits; track benefit.text; let j = $index) {
                    <li class="benefit-item" [style.animation-delay]="(j * 0.1) + 's'">
                      <div class="benefit-marker" [style.--marker-color]="segment.accentColor">
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                          <path d="M5 12l5 5L19 7" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </div>
                      <span class="benefit-text">{{ benefit.text }}</span>
                      @if (benefit.highlight) {
                        <span class="benefit-highlight" [style.--highlight-color]="segment.accentColor">
                          {{ benefit.highlight }}
                        </span>
                      }
                    </li>
                  }
                </ul>

                <!-- CTA Button -->
                <a
                  [href]="segment.ctaLink"
                  class="card-cta"
                  [style.--cta-color]="segment.accentColor"
                  [style.--cta-bg]="segment.ctaBg"
                >
                  <span class="cta-text">{{ segment.cta }}</span>
                  <span class="cta-arrow">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M5 12h14m-7-7l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                </a>
              </div>

              <!-- Decorative Corner -->
              <div class="card-corner" [style.--corner-color]="segment.accentColor"></div>
            </div>
          }
        </div>

        <!-- Bottom Stats Bar -->
        <div class="animate-in delay-600 stats-bar">
          <div class="stat-item">
            <span class="stat-number">+1.000</span>
            <span class="stat-label">pacientes activos</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-number">+500</span>
            <span class="stat-label">ejercicios HD</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-number">4.9</span>
            <span class="stat-label">valoracion media</span>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ============================================
       SECTION BASE
       ============================================ */
    .benefits-section {
      position: relative;
      background: linear-gradient(180deg, #fffaf7 0%, #fff5ef 50%, #ffede3 100%);
    }

    /* ============================================
       ANIMATED WAVES BACKGROUND
       ============================================ */
    .waves-container {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }

    .wave {
      position: absolute;
      width: 100%;
    }

    .wave-top {
      top: 0;
      left: 0;
      height: 40%;
      min-height: 250px;
    }

    .wave-bottom {
      bottom: 0;
      left: 0;
      height: 35%;
      min-height: 200px;
      transform: scaleY(-1);
    }

    .wave-side-left {
      left: 0;
      top: 0;
      width: 15%;
      height: 100%;
      max-width: 200px;
    }

    .wave-side-right {
      right: 0;
      top: 0;
      width: 15%;
      height: 100%;
      max-width: 200px;
    }

    .wave-path {
      transition: opacity 0.5s ease;
    }

    /* Responsive wave sizing */
    @media (max-width: 768px) {
      .wave-top {
        height: 30%;
        min-height: 150px;
      }

      .wave-bottom {
        height: 25%;
        min-height: 120px;
      }

      .wave-side-left,
      .wave-side-right {
        width: 10%;
        opacity: 0.7;
      }
    }

    /* ============================================
       GRAIN TEXTURE
       ============================================ */
    .grain-overlay {
      position: absolute;
      inset: 0;
      opacity: 0.25;
      pointer-events: none;
      mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    }

    /* ============================================
       FLOATING DECORATIVE DOTS
       ============================================ */
    .floating-elements {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 1;
    }

    .floating-dot {
      position: absolute;
      border-radius: 50%;
    }

    .dot-1 {
      width: 10px;
      height: 10px;
      top: 20%;
      right: 18%;
      background: linear-gradient(135deg, #e75c3e, #f7a65e);
      opacity: 0.5;
      animation: dotFloat 6s ease-in-out infinite;
      box-shadow: 0 4px 12px rgba(231, 92, 62, 0.3);
    }

    .dot-2 {
      width: 8px;
      height: 8px;
      bottom: 30%;
      left: 12%;
      background: linear-gradient(135deg, #efc048, #fdd6b3);
      opacity: 0.6;
      animation: dotFloat 8s ease-in-out infinite reverse;
      box-shadow: 0 4px 12px rgba(239, 192, 72, 0.3);
    }

    .dot-3 {
      width: 12px;
      height: 12px;
      top: 55%;
      right: 10%;
      background: linear-gradient(135deg, #f7a65e, #e75c3e);
      opacity: 0.35;
      animation: dotFloat 7s ease-in-out infinite;
      box-shadow: 0 4px 12px rgba(231, 92, 62, 0.2);
    }

    @keyframes dotFloat {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-25px) scale(1.1); }
    }

    @media (max-width: 768px) {
      .floating-dot {
        opacity: 0.3;
      }

      .dot-1, .dot-2, .dot-3 {
        width: 6px;
        height: 6px;
      }
    }

    /* ============================================
       TITLE GRADIENT
       ============================================ */
    .title-gradient {
      background: linear-gradient(135deg, #e75c3e 0%, #d97706 50%, #efc048 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* ============================================
       CARDS CONTAINER - ASYMMETRIC GRID
       ============================================ */
    .cards-container {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
    }

    @media (min-width: 768px) {
      .cards-container {
        grid-template-columns: repeat(2, 1fr);
        gap: 28px;
      }

      .card-clinicas {
        grid-column: span 2;
        max-width: 600px;
        margin: 0 auto;
      }
    }

    @media (min-width: 1024px) {
      .cards-container {
        grid-template-columns: repeat(3, 1fr);
        gap: 32px;
      }

      .card-clinicas {
        grid-column: span 1;
        max-width: none;
        margin: 0;
      }
    }

    /* ============================================
       BENEFIT CARD
       ============================================ */
    .benefit-card {
      position: relative;
      border-radius: 32px;
      transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .benefit-card:hover {
      transform: translateY(-12px);
    }

    .card-border-glow {
      position: absolute;
      inset: 0;
      border-radius: 32px;
      padding: 2px;
      background: linear-gradient(
        135deg,
        var(--glow-color) 0%,
        transparent 50%,
        var(--glow-color) 100%
      );
      opacity: 0;
      transition: opacity 0.5s ease;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }

    .benefit-card:hover .card-border-glow {
      opacity: 1;
    }

    .card-inner {
      position: relative;
      padding: 36px;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 32px;
      box-shadow:
        0 4px 24px rgba(231, 92, 62, 0.03),
        0 12px 48px rgba(0, 0, 0, 0.04);
      transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .benefit-card:hover .card-inner {
      background: rgba(255, 255, 255, 0.92);
      box-shadow:
        0 8px 32px rgba(231, 92, 62, 0.06),
        0 24px 80px rgba(0, 0, 0, 0.08);
    }

    /* ============================================
       CARD HEADER
       ============================================ */
    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    /* ============================================
       ICON ORBIT ANIMATION
       ============================================ */
    .icon-orbit {
      position: relative;
      width: 72px;
      height: 72px;
    }

    .orbit-ring {
      position: absolute;
      inset: -8px;
      border: 1px dashed var(--accent-color);
      border-radius: 50%;
      opacity: 0.3;
      animation: orbitSpin 20s linear infinite;
    }

    @keyframes orbitSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .icon-core {
      position: relative;
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 24px;
      color: var(--accent-color);
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .benefit-card:hover .icon-core {
      transform: scale(1.1) rotate(-5deg);
    }

    .benefit-card:hover .orbit-ring {
      opacity: 0.6;
      animation-duration: 10s;
    }

    /* ============================================
       TAG BADGE
       ============================================ */
    .tag-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: var(--tag-bg);
      color: var(--tag-color);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 100px;
    }

    .tag-dot {
      width: 6px;
      height: 6px;
      background: var(--tag-color);
      border-radius: 50%;
      animation: tagPulse 2s ease-in-out infinite;
    }

    @keyframes tagPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    /* ============================================
       CARD TITLE & DESCRIPTION
       ============================================ */
    .card-title {
      font-size: 28px;
      font-weight: 800;
      color: #1a1a2e;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
    }

    .card-description {
      font-size: 16px;
      color: #64748b;
      line-height: 1.7;
      margin-bottom: 24px;
    }

    /* ============================================
       CARD DIVIDER
       ============================================ */
    .card-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .divider-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.08) 50%, transparent 100%);
    }

    .divider-icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.03);
      border-radius: 8px;
      color: #cbd5e1;
    }

    /* ============================================
       BENEFITS LIST
       ============================================ */
    .benefits-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 28px;
      list-style: none;
      padding: 0;
      margin-top: 0;
    }

    .benefit-item {
      display: flex;
      align-items: center;
      gap: 14px;
      opacity: 0;
      animation: itemFadeIn 0.5s ease forwards;
    }

    @keyframes itemFadeIn {
      from { opacity: 0; transform: translateX(-10px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .benefit-marker {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--marker-color) 0%, color-mix(in srgb, var(--marker-color) 80%, #000) 100%);
      border-radius: 8px;
      color: white;
      box-shadow: 0 2px 8px color-mix(in srgb, var(--marker-color) 40%, transparent);
    }

    .benefit-text {
      flex: 1;
      font-size: 15px;
      font-weight: 500;
      color: #334155;
    }

    .benefit-highlight {
      padding: 4px 10px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--highlight-color) 15%, transparent), color-mix(in srgb, var(--highlight-color) 8%, transparent));
      color: var(--highlight-color);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-radius: 6px;
    }

    /* ============================================
       CARD CTA
       ============================================ */
    .card-cta {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 14px 24px;
      background: var(--cta-bg);
      color: white;
      font-size: 15px;
      font-weight: 600;
      border-radius: 16px;
      text-decoration: none;
      overflow: hidden;
      position: relative;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .card-cta::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%);
      opacity: 0;
      transition: opacity 0.4s ease;
    }

    .card-cta:hover::before {
      opacity: 1;
    }

    .card-cta:hover {
      transform: translateX(4px);
      box-shadow: 0 8px 24px color-mix(in srgb, var(--cta-color) 35%, transparent);
    }

    .cta-text {
      position: relative;
      z-index: 1;
    }

    .cta-arrow {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease;
    }

    .card-cta:hover .cta-arrow {
      transform: translateX(4px);
    }

    /* ============================================
       CARD CORNER DECORATION
       ============================================ */
    .card-corner {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 120px;
      height: 120px;
      background: radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--corner-color) 8%, transparent) 0%, transparent 70%);
      border-radius: 0 0 32px 0;
      pointer-events: none;
    }

    /* ============================================
       STATS BAR
       ============================================ */
    .stats-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 24px;
      margin-top: 48px;
      padding: 32px 40px;
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 24px;
      box-shadow: 0 4px 24px rgba(231, 92, 62, 0.04);
    }

    @media (min-width: 640px) {
      .stats-bar {
        gap: 48px;
      }
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .stat-number {
      font-size: 32px;
      font-weight: 800;
      background: linear-gradient(135deg, #e75c3e 0%, #efc048 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .stat-label {
      font-size: 14px;
      color: #64748b;
      font-weight: 500;
    }

    .stat-divider {
      width: 1px;
      height: 40px;
      background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.1) 50%, transparent 100%);
    }

    @media (max-width: 639px) {
      .stat-divider {
        display: none;
      }

      .stats-bar {
        gap: 32px;
      }

      .stat-item {
        flex: 1;
        min-width: 100px;
      }
    }

    /* ============================================
       RESPONSIVE ADJUSTMENTS
       ============================================ */
    @media (max-width: 640px) {
      .card-inner {
        padding: 28px;
      }

      .card-title {
        font-size: 24px;
      }

      .icon-orbit {
        width: 64px;
        height: 64px;
      }

      .icon-core {
        width: 64px;
        height: 64px;
        border-radius: 20px;
      }

      .orbit-ring {
        inset: -6px;
      }
    }

    /* ============================================
       REDUCED MOTION
       ============================================ */
    @media (prefers-reduced-motion: reduce) {
      .wave-path,
      .floating-dot,
      .orbit-ring,
      .tag-dot,
      .benefit-item {
        animation: none !important;
      }

      .wave-path animate {
        display: none;
      }

      .benefit-card,
      .card-cta,
      .icon-core {
        transition: none !important;
      }

      .benefit-item {
        opacity: 1;
      }
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
      iconBg: 'linear-gradient(135deg, rgba(231, 92, 62, 0.12) 0%, rgba(255, 200, 180, 0.08) 100%)',
      glowColor: 'rgba(231, 92, 62, 0.5)',
      ctaColor: '#e75c3e',
      ctaBg: 'linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%)',
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
      iconBg: 'linear-gradient(135deg, rgba(239, 192, 72, 0.15) 0%, rgba(255, 220, 180, 0.08) 100%)',
      glowColor: 'rgba(239, 192, 72, 0.5)',
      ctaColor: '#d97706',
      ctaBg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
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
      iconBg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(165, 180, 252, 0.08) 100%)',
      glowColor: 'rgba(99, 102, 241, 0.5)',
      ctaColor: '#6366f1',
      ctaBg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
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
