import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-how-it-works',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="como-funciona" class="how-it-works-section relative py-28 lg:py-40 overflow-hidden">
      <!-- Animated Wave Background -->
      <div class="waves-container">
        <!-- Top Waves -->
        <svg class="wave wave-top" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hiw-wave-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fff5ef" />
              <stop offset="50%" stop-color="#ffe8d6" />
              <stop offset="100%" stop-color="#fdd6b3" />
            </linearGradient>
          </defs>
          <path class="wave-path" fill="url(#hiw-wave-gradient-1)" fill-opacity="0.5">
            <animate
              attributeName="d"
              dur="22s"
              repeatCount="indefinite"
              values="
                M0,140 C320,200 640,80 960,160 C1280,240 1440,120 1440,120 L1440,0 L0,0 Z;
                M0,120 C320,60 640,180 960,100 C1280,20 1440,160 1440,160 L1440,0 L0,0 Z;
                M0,160 C320,100 640,220 960,140 C1280,60 1440,180 1440,180 L1440,0 L0,0 Z;
                M0,140 C320,200 640,80 960,160 C1280,240 1440,120 1440,120 L1440,0 L0,0 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
          <path class="wave-path" fill="#fdd6b3" fill-opacity="0.35">
            <animate
              attributeName="d"
              dur="18s"
              repeatCount="indefinite"
              values="
                M0,80 C360,160 720,40 1080,120 C1260,160 1440,80 1440,80 L1440,0 L0,0 Z;
                M0,120 C360,40 720,160 1080,80 C1260,120 1440,160 1440,160 L1440,0 L0,0 Z;
                M0,60 C360,140 720,20 1080,100 C1260,140 1440,60 1440,60 L1440,0 L0,0 Z;
                M0,80 C360,160 720,40 1080,120 C1260,160 1440,80 1440,80 L1440,0 L0,0 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>

        <!-- Bottom Waves -->
        <svg class="wave wave-bottom" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hiw-wave-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fdd6b3" />
              <stop offset="50%" stop-color="#f7a65e" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#ffedd6" />
            </linearGradient>
          </defs>
          <path class="wave-path" fill="url(#hiw-wave-gradient-2)" fill-opacity="0.45">
            <animate
              attributeName="d"
              dur="24s"
              repeatCount="indefinite"
              values="
                M0,140 C240,60 480,220 720,140 C960,60 1200,180 1440,140 L1440,320 L0,320 Z;
                M0,180 C240,260 480,100 720,180 C960,260 1200,80 1440,180 L1440,320 L0,320 Z;
                M0,160 C240,80 480,240 720,160 C960,80 1200,200 1440,160 L1440,320 L0,320 Z;
                M0,140 C240,60 480,220 720,140 C960,60 1200,180 1440,140 L1440,320 L0,320 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
          <path class="wave-path" fill="#e75c3e" fill-opacity="0.06">
            <animate
              attributeName="d"
              dur="30s"
              repeatCount="indefinite"
              values="
                M0,200 C360,120 720,260 1080,180 C1260,140 1440,220 1440,220 L1440,320 L0,320 Z;
                M0,160 C360,240 720,120 1080,200 C1260,240 1440,160 1440,160 L1440,320 L0,320 Z;
                M0,220 C360,140 720,280 1080,200 C1260,160 1440,240 1440,240 L1440,320 L0,320 Z;
                M0,200 C360,120 720,260 1080,180 C1260,140 1440,220 1440,220 L1440,320 L0,320 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>

        <!-- Side Accent Waves -->
        <svg class="wave wave-side-left" viewBox="0 0 200 800" preserveAspectRatio="none">
          <path fill="#efc048" fill-opacity="0.1">
            <animate
              attributeName="d"
              dur="16s"
              repeatCount="indefinite"
              values="
                M0,0 Q80,180 40,380 Q0,580 60,800 L0,800 L0,0 Z;
                M0,0 Q60,130 20,330 Q-30,530 40,800 L0,800 L0,0 Z;
                M0,0 Q100,230 50,430 Q10,630 80,800 L0,800 L0,0 Z;
                M0,0 Q80,180 40,380 Q0,580 60,800 L0,800 L0,0 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>

        <svg class="wave wave-side-right" viewBox="0 0 200 800" preserveAspectRatio="none">
          <path fill="#e75c3e" fill-opacity="0.06">
            <animate
              attributeName="d"
              dur="19s"
              repeatCount="indefinite"
              values="
                M200,0 Q120,180 160,380 Q200,580 140,800 L200,800 L200,0 Z;
                M200,0 Q140,130 180,330 Q230,530 160,800 L200,800 L200,0 Z;
                M200,0 Q100,230 140,430 Q190,630 120,800 L200,800 L200,0 Z;
                M200,0 Q120,180 160,380 Q200,580 140,800 L200,800 L200,0 Z
              "
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </path>
        </svg>
      </div>

      <!-- Grain Texture Overlay -->
      <div class="grain-overlay"></div>

      <!-- Floating Decorative Elements -->
      <div class="floating-elements">
        <div class="floating-dot dot-1"></div>
        <div class="floating-dot dot-2"></div>
        <div class="floating-dot dot-3"></div>
        <div class="floating-ring ring-1"></div>
        <div class="floating-ring ring-2"></div>
      </div>

      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center max-w-4xl mx-auto mb-20 lg:mb-28">
          <div class="animate-in inline-flex items-center gap-3 mb-8">
            <span class="h-px w-12 bg-gradient-to-r from-transparent to-primary"></span>
            <span class="header-badge">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke-linecap="round"/>
              </svg>
              Facil de usar
            </span>
            <span class="h-px w-12 bg-gradient-to-l from-transparent to-primary"></span>
          </div>

          <h2 class="animate-in delay-100 text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-8">
            Como funciona
            <br />
            <span class="title-gradient">Kengo</span>
          </h2>

          <p class="animate-in delay-200 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
            En 4 sencillos pasos estaras siguiendo tu tratamiento de forma guiada,
            con feedback en tiempo real y tu fisio siempre informado.
          </p>
        </div>

        <!-- Timeline Container -->
        <div class="timeline-container">
          <!-- Connection Line (Desktop) -->
          <div class="timeline-line hidden lg:block">
            <div class="timeline-progress"></div>
          </div>

          <!-- Steps Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            @for (step of steps; track step.id; let i = $index) {
              <div
                class="animate-in step-card"
                [style.animation-delay]="(i * 0.15) + 's'"
              >
                <!-- Floating Number Badge -->
                <div class="step-number-container">
                  <div class="step-number-wrapper">
                    <div class="step-number" [style.--step-delay]="i">
                      <span>{{ step.number }}</span>
                    </div>
                    <div class="step-pulse-ring"></div>
                    <div class="step-pulse-ring delay-1"></div>
                  </div>
                  <!-- Connector Dot (visible on desktop) -->
                  <div class="connector-dot hidden lg:block"></div>
                </div>

                <!-- Card -->
                <div class="card-wrapper">
                  <!-- Glow Effect on Hover -->
                  <div class="card-glow" [style.--glow-color]="step.glowColor"></div>

                  <div class="card-inner">
                    <!-- Icon Container -->
                    <div class="icon-container">
                      <div class="icon-orbit">
                        <div class="orbit-ring"></div>
                        <div class="orbit-dot dot-a"></div>
                        <div class="orbit-dot dot-b"></div>
                      </div>
                      <div class="icon-core" [style.--icon-gradient]="step.iconGradient">
                        @switch (step.id) {
                          @case ('plan') {
                            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                              <rect x="4" y="3" width="16" height="18" rx="2"/>
                              <path d="M8 7h8"/>
                              <path d="M8 11h8"/>
                              <path d="M8 15h5"/>
                              <circle cx="17" cy="15" r="2.5" fill="#22c55e" stroke="none"/>
                              <path d="M15.5 15l1 1 2-2" stroke="#fff" stroke-width="1.5"/>
                            </svg>
                          }
                          @case ('actividad') {
                            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                              <rect x="5" y="2" width="14" height="20" rx="3"/>
                              <path d="M9 2v2h6V2"/>
                              <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none"/>
                              <path d="M9 8h6"/>
                              <path d="M9 11h4"/>
                              <circle cx="12" cy="11" r="5" stroke="currentColor" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.4"/>
                            </svg>
                          }
                          @case ('sesion') {
                            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                              <rect x="2" y="4" width="20" height="14" rx="3"/>
                              <polygon points="10,8 16,11 10,14" fill="currentColor" stroke="none"/>
                              <rect x="2" y="16" width="20" height="2" rx="1" fill="currentColor" opacity="0.2" stroke="none"/>
                              <circle cx="6" cy="17" r="1" fill="#efc048" stroke="none"/>
                              <rect x="8" y="16.5" width="8" height="1" rx="0.5" fill="#efc048" opacity="0.5" stroke="none"/>
                            </svg>
                          }
                          @case ('feedback') {
                            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                              <path d="M8 12h.01M12 12h.01M16 12h.01" stroke-width="2"/>
                              <circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.3"/>
                            </svg>
                          }
                        }
                      </div>
                    </div>

                    <!-- Content -->
                    <div class="card-content">
                      <h3 class="card-title">{{ step.title }}</h3>
                      <p class="card-description">{{ step.description }}</p>

                      <!-- Feature Tags -->
                      <div class="tags-container">
                        @for (tag of step.tags; track tag; let j = $index) {
                          <span
                            class="feature-tag"
                            [style.animation-delay]="((i * 0.15) + (j * 0.08)) + 's'"
                          >
                            <span class="tag-dot"></span>
                            {{ tag }}
                          </span>
                        }
                      </div>
                    </div>

                    <!-- Corner Decoration -->
                    <div class="card-corner" [style.--corner-color]="step.accentColor"></div>
                  </div>
                </div>

                <!-- Mobile Arrow -->
                @if (i < steps.length - 1) {
                  <div class="step-arrow lg:hidden">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 5v14m-7-7l7 7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Bottom CTA -->
        <div class="animate-in delay-700 cta-container">
          <a
            href="https://app.kengoapp.com/registro"
            class="cta-button"
          >
            <span class="cta-bg"></span>
            <span class="cta-content">
              <span class="cta-text">Empezar mi tratamiento</span>
              <span class="cta-arrow">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14m-7-7l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </span>
          </a>
          <p class="cta-subtext">
            <span class="subtext-item">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Sin tarjeta de credito
            </span>
            <span class="subtext-divider"></span>
            <span class="subtext-item">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              Configuracion en 2 min
            </span>
          </p>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ============================================
       SECTION BASE
       ============================================ */
    .how-it-works-section {
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
      height: 35%;
      min-height: 200px;
    }

    .wave-bottom {
      bottom: 0;
      left: 0;
      height: 30%;
      min-height: 180px;
      transform: scaleY(-1);
    }

    .wave-side-left {
      left: 0;
      top: 0;
      width: 12%;
      height: 100%;
      max-width: 180px;
    }

    .wave-side-right {
      right: 0;
      top: 0;
      width: 12%;
      height: 100%;
      max-width: 180px;
    }

    @media (max-width: 768px) {
      .wave-top { height: 25%; min-height: 120px; }
      .wave-bottom { height: 20%; min-height: 100px; }
      .wave-side-left, .wave-side-right { width: 8%; opacity: 0.6; }
    }

    /* ============================================
       GRAIN TEXTURE
       ============================================ */
    .grain-overlay {
      position: absolute;
      inset: 0;
      opacity: 0.2;
      pointer-events: none;
      mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    }

    /* ============================================
       FLOATING DECORATIVE ELEMENTS
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
      width: 8px;
      height: 8px;
      top: 18%;
      right: 15%;
      background: linear-gradient(135deg, #e75c3e, #f7a65e);
      opacity: 0.45;
      animation: dotFloat 7s ease-in-out infinite;
      box-shadow: 0 4px 12px rgba(231, 92, 62, 0.25);
    }

    .dot-2 {
      width: 6px;
      height: 6px;
      bottom: 35%;
      left: 10%;
      background: linear-gradient(135deg, #efc048, #fdd6b3);
      opacity: 0.55;
      animation: dotFloat 9s ease-in-out infinite reverse;
      box-shadow: 0 4px 12px rgba(239, 192, 72, 0.25);
    }

    .dot-3 {
      width: 10px;
      height: 10px;
      top: 60%;
      right: 8%;
      background: linear-gradient(135deg, #f7a65e, #e75c3e);
      opacity: 0.3;
      animation: dotFloat 8s ease-in-out infinite;
      box-shadow: 0 4px 12px rgba(231, 92, 62, 0.15);
    }

    .floating-ring {
      position: absolute;
      border-radius: 50%;
      border: 1px solid;
    }

    .ring-1 {
      width: 80px;
      height: 80px;
      top: 25%;
      left: 8%;
      border-color: rgba(231, 92, 62, 0.12);
      animation: ringPulse 10s ease-in-out infinite;
    }

    .ring-2 {
      width: 60px;
      height: 60px;
      bottom: 20%;
      right: 12%;
      border-color: rgba(239, 192, 72, 0.15);
      animation: ringPulse 12s ease-in-out infinite reverse;
    }

    @keyframes dotFloat {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-20px) scale(1.1); }
    }

    @keyframes ringPulse {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.15); opacity: 0.2; }
    }

    @media (max-width: 768px) {
      .floating-dot, .floating-ring { opacity: 0.25; }
      .dot-1, .dot-2, .dot-3 { width: 5px; height: 5px; }
      .ring-1, .ring-2 { display: none; }
    }

    /* ============================================
       HEADER STYLES
       ============================================ */
    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 100px;
      color: #e75c3e;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.02em;
      box-shadow: 0 4px 16px rgba(231, 92, 62, 0.08);
    }

    .title-gradient {
      background: linear-gradient(135deg, #e75c3e 0%, #d97706 50%, #efc048 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* ============================================
       TIMELINE CONTAINER
       ============================================ */
    .timeline-container {
      position: relative;
    }

    .timeline-line {
      position: absolute;
      top: 32px;
      left: calc(12.5% + 28px);
      right: calc(12.5% + 28px);
      height: 4px;
      background: rgba(255, 255, 255, 0.6);
      border-radius: 2px;
      overflow: hidden;
      z-index: 0;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .timeline-progress {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg,
        #e75c3e 0%,
        #f7a65e 33%,
        #efc048 66%,
        #22c55e 100%
      );
      border-radius: 2px;
      animation: progressShimmer 4s ease-in-out infinite;
    }

    @keyframes progressShimmer {
      0% { opacity: 0.4; transform: scaleX(0); transform-origin: left; }
      50% { opacity: 1; transform: scaleX(1); transform-origin: left; }
      50.1% { transform-origin: right; }
      100% { opacity: 0.4; transform: scaleX(0); transform-origin: right; }
    }

    /* ============================================
       STEP CARD
       ============================================ */
    .step-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* ============================================
       STEP NUMBER
       ============================================ */
    .step-number-container {
      position: relative;
      z-index: 10;
      margin-bottom: 20px;
    }

    .step-number-wrapper {
      position: relative;
    }

    .step-number {
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
      border-radius: 18px;
      box-shadow:
        0 4px 16px rgba(231, 92, 62, 0.35),
        0 0 0 4px rgba(255, 255, 255, 0.8);
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .step-card:hover .step-number {
      transform: scale(1.1) rotate(-5deg);
      box-shadow:
        0 8px 28px rgba(231, 92, 62, 0.45),
        0 0 0 6px rgba(255, 255, 255, 0.9);
    }

    .step-number span {
      font-size: 22px;
      font-weight: 800;
      color: white;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    }

    .step-pulse-ring {
      position: absolute;
      inset: -6px;
      border-radius: 22px;
      border: 2px solid rgba(231, 92, 62, 0.25);
      animation: stepPulse 2.5s ease-out infinite;
    }

    .step-pulse-ring.delay-1 {
      animation-delay: 1.25s;
    }

    @keyframes stepPulse {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    .connector-dot {
      position: absolute;
      bottom: -28px;
      left: 50%;
      transform: translateX(-50%);
      width: 10px;
      height: 10px;
      background: linear-gradient(135deg, #e75c3e, #efc048);
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(231, 92, 62, 0.3);
    }

    /* ============================================
       CARD WRAPPER
       ============================================ */
    .card-wrapper {
      position: relative;
      width: 100%;
    }

    .card-glow {
      position: absolute;
      inset: -2px;
      border-radius: 28px;
      background: linear-gradient(135deg, var(--glow-color) 0%, transparent 50%, var(--glow-color) 100%);
      opacity: 0;
      transition: opacity 0.5s ease;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      padding: 2px;
    }

    .step-card:hover .card-glow {
      opacity: 1;
    }

    .card-inner {
      position: relative;
      padding: 32px 24px;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 28px;
      box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.04),
        0 8px 40px rgba(231, 92, 62, 0.03);
      transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      text-align: center;
      overflow: hidden;
    }

    .step-card:hover .card-inner {
      transform: translateY(-8px);
      background: rgba(255, 255, 255, 0.9);
      box-shadow:
        0 12px 40px rgba(0, 0, 0, 0.08),
        0 20px 60px rgba(231, 92, 62, 0.06);
    }

    /* ============================================
       ICON CONTAINER
       ============================================ */
    .icon-container {
      position: relative;
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
    }

    .icon-orbit {
      position: absolute;
      inset: -10px;
    }

    .orbit-ring {
      position: absolute;
      inset: 0;
      border: 1px dashed rgba(231, 92, 62, 0.2);
      border-radius: 50%;
      animation: orbitSpin 25s linear infinite;
    }

    @keyframes orbitSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .orbit-dot {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .orbit-dot.dot-a {
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      background: #e75c3e;
      box-shadow: 0 0 8px rgba(231, 92, 62, 0.5);
    }

    .orbit-dot.dot-b {
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      background: #efc048;
      box-shadow: 0 0 8px rgba(239, 192, 72, 0.5);
    }

    .step-card:hover .orbit-ring {
      animation-duration: 12s;
      border-color: rgba(231, 92, 62, 0.35);
    }

    .icon-core {
      position: relative;
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--icon-gradient);
      border-radius: 24px;
      color: #e75c3e;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .step-card:hover .icon-core {
      transform: scale(1.08);
      box-shadow: 0 8px 24px rgba(231, 92, 62, 0.15);
    }

    /* ============================================
       CARD CONTENT
       ============================================ */
    .card-content {
      position: relative;
      z-index: 1;
    }

    .card-title {
      font-size: 20px;
      font-weight: 800;
      color: #1a1a2e;
      letter-spacing: -0.01em;
      margin-bottom: 10px;
    }

    .card-description {
      font-size: 14px;
      color: #64748b;
      line-height: 1.65;
      margin-bottom: 18px;
    }

    /* ============================================
       FEATURE TAGS
       ============================================ */
    .tags-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }

    .feature-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.08) 0%, rgba(239, 192, 72, 0.05) 100%);
      border: 1px solid rgba(231, 92, 62, 0.1);
      border-radius: 100px;
      font-size: 11px;
      font-weight: 700;
      color: #e75c3e;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0;
      animation: tagFadeIn 0.4s ease forwards;
    }

    @keyframes tagFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .tag-dot {
      width: 5px;
      height: 5px;
      background: linear-gradient(135deg, #e75c3e, #efc048);
      border-radius: 50%;
      animation: tagDotPulse 2s ease-in-out infinite;
    }

    @keyframes tagDotPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* ============================================
       CARD CORNER
       ============================================ */
    .card-corner {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 100px;
      height: 100px;
      background: radial-gradient(
        circle at 100% 100%,
        color-mix(in srgb, var(--corner-color) 6%, transparent) 0%,
        transparent 70%
      );
      border-radius: 0 0 28px 0;
      pointer-events: none;
    }

    /* ============================================
       STEP ARROW (Mobile)
       ============================================ */
    .step-arrow {
      position: absolute;
      bottom: -28px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(231, 92, 62, 0.35);
      animation: arrowBounce 2s ease-in-out infinite;
    }

    @keyframes arrowBounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(6px); }
    }

    /* ============================================
       CTA CONTAINER
       ============================================ */
    .cta-container {
      text-align: center;
      margin-top: 56px;
    }

    .cta-button {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 18px 36px;
      border-radius: 18px;
      text-decoration: none;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .cta-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
      border-radius: 18px;
      transition: all 0.4s ease;
    }

    .cta-button::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
      border-radius: 18px;
      opacity: 0;
      transition: opacity 0.4s ease;
    }

    .cta-button:hover::before {
      opacity: 1;
    }

    .cta-button:hover {
      transform: translateY(-3px);
      box-shadow:
        0 12px 32px rgba(231, 92, 62, 0.4),
        0 4px 12px rgba(231, 92, 62, 0.2);
    }

    .cta-button:active {
      transform: translateY(-1px) scale(0.98);
    }

    .cta-content {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .cta-text {
      font-size: 17px;
      font-weight: 700;
      color: white;
      letter-spacing: 0.01em;
    }

    .cta-arrow {
      display: flex;
      align-items: center;
      color: white;
      transition: transform 0.3s ease;
    }

    .cta-button:hover .cta-arrow {
      transform: translateX(4px);
    }

    .cta-subtext {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 20px;
    }

    .subtext-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #64748b;
      font-weight: 500;
    }

    .subtext-item svg {
      color: #22c55e;
    }

    .subtext-divider {
      width: 4px;
      height: 4px;
      background: #cbd5e1;
      border-radius: 50%;
    }

    /* ============================================
       RESPONSIVE ADJUSTMENTS
       ============================================ */
    @media (max-width: 1023px) {
      .step-card {
        margin-bottom: 48px;
      }

      .step-card:last-child {
        margin-bottom: 0;
      }
    }

    @media (max-width: 640px) {
      .step-number {
        width: 48px;
        height: 48px;
        border-radius: 16px;
      }

      .step-number span {
        font-size: 18px;
      }

      .card-inner {
        padding: 28px 20px;
      }

      .icon-container {
        width: 70px;
        height: 70px;
      }

      .icon-core {
        width: 70px;
        height: 70px;
        border-radius: 20px;
      }

      .card-title {
        font-size: 18px;
      }

      .cta-button {
        padding: 16px 28px;
      }

      .cta-text {
        font-size: 15px;
      }

      .cta-subtext {
        flex-direction: column;
        gap: 8px;
      }

      .subtext-divider {
        display: none;
      }
    }

    /* ============================================
       REDUCED MOTION
       ============================================ */
    @media (prefers-reduced-motion: reduce) {
      .wave-path animate,
      .floating-dot,
      .floating-ring,
      .orbit-ring,
      .step-pulse-ring,
      .tag-dot,
      .step-arrow,
      .timeline-progress {
        animation: none !important;
      }

      .step-card,
      .card-inner,
      .step-number,
      .icon-core,
      .cta-button {
        transition: none !important;
      }

      .feature-tag {
        opacity: 1;
      }

      .step-pulse-ring {
        display: none;
      }
    }
  `]
})
export class HowItWorksComponent {
  steps = [
    {
      id: 'plan',
      number: 1,
      title: 'El fisio crea tu plan',
      description: 'Selecciona ejercicios personalizados para tu lesion, adaptados a tu ritmo de vida y objetivos.',
      tags: ['Personalizado', 'Rapido'],
      accentColor: '#e75c3e',
      glowColor: 'rgba(231, 92, 62, 0.4)',
      iconGradient: 'linear-gradient(135deg, rgba(231, 92, 62, 0.12) 0%, rgba(255, 200, 180, 0.06) 100%)',
    },
    {
      id: 'actividad',
      number: 2,
      title: 'Recibe tu actividad',
      description: 'Ve que ejercicios tocan cada dia con videos incluidos, directamente en tu movil.',
      tags: ['Notificaciones', 'Calendario'],
      accentColor: '#f7a65e',
      glowColor: 'rgba(247, 166, 94, 0.4)',
      iconGradient: 'linear-gradient(135deg, rgba(247, 166, 94, 0.12) 0%, rgba(255, 220, 180, 0.06) 100%)',
    },
    {
      id: 'sesion',
      number: 3,
      title: 'Sesion guiada',
      description: 'Sigue el video HD, las series y los descansos paso a paso. Como tener al fisio en casa.',
      tags: ['Video HD', 'Temporizador'],
      accentColor: '#efc048',
      glowColor: 'rgba(239, 192, 72, 0.4)',
      iconGradient: 'linear-gradient(135deg, rgba(239, 192, 72, 0.12) 0%, rgba(255, 230, 180, 0.06) 100%)',
    },
    {
      id: 'feedback',
      number: 4,
      title: 'Feedback instantaneo',
      description: 'Registra como te sientes y tu fisio ajusta el tratamiento en tiempo real.',
      tags: ['Dolor', 'Progreso'],
      accentColor: '#22c55e',
      glowColor: 'rgba(34, 197, 94, 0.4)',
      iconGradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(180, 255, 200, 0.06) 100%)',
    },
  ];
}
