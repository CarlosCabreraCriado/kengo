import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-hero',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section
      class="hero-section relative flex h-screen items-center justify-center overflow-hidden"
    >
      <!-- Aurora Background -->
      <div class="aurora-bg">
        <div class="aurora-wave aurora-wave-1"></div>
        <div class="aurora-wave aurora-wave-2"></div>
        <div class="aurora-wave aurora-wave-3"></div>
        <div class="aurora-wave aurora-wave-4"></div>
      </div>

      <!-- Subtle Pattern Overlay -->
      <div class="pattern-dots absolute inset-0 z-[1] opacity-30"></div>

      <!-- Gradient Overlay -->
      <div class="kengo-gradient-subtle absolute inset-0 z-[2]"></div>

      <!-- Content -->
      <div
        class="pointer-events-none fixed z-10 mx-auto w-full max-w-7xl px-4 py-32 sm:px-6 lg:px-8"
      >
        <div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <!-- Text Content -->
          <div class="text-center lg:text-left">
            <!-- Headline -->
            <h1
              class="animate-in text-4xl leading-tight font-bold tracking-tight text-gray-900 delay-100 sm:text-5xl lg:text-6xl xl:text-7xl"
            >
              Tu
              <span class="hero-highlight relative inline-block">
                <span class="text-primary relative z-10">fisioterapeuta</span>
                <svg
                  class="highlight-underline absolute -bottom-2 left-0 w-full"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,8 Q50,0 100,8 T200,8"
                    fill="none"
                    stroke="url(#gradient)"
                    stroke-width="4"
                    stroke-linecap="round"
                  />
                  <defs>
                    <linearGradient
                      id="gradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stop-color="#e75c3e" />
                      <stop offset="100%" stop-color="#efc048" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              <br class="hidden sm:block" />
              siempre contigo
            </h1>

            <!-- Subtitle -->
            <p
              class="animate-in mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-600 delay-200 sm:text-xl lg:mx-0"
            >
              Planes de ejercicios personalizados con videos guiados,
              seguimiento de progreso y
              <span class="font-semibold text-gray-800"
                >conexion directa con tu fisioterapeuta</span
              >.
            </p>

            <!-- CTAs -->
            <div
              class="animate-in !pointer-events-auto mt-10 flex flex-col justify-center gap-4 delay-300 sm:flex-row lg:justify-start"
            >
              <a
                href="https://kengoapp.com/login"
                class="btn-kengo group text-lg"
              >
                <span>Empieza gratis</span>
                <svg
                  class="h-5 w-5 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </a>
            </div>
          </div>

          <!-- Visual Element -->
          <div class="animate-in relative hidden delay-200 lg:block">
            <div class="hero-visual-container relative">
              <!-- Phone Mockup -->
              <div class="phone-mockup animate-float">
                <div class="phone-screen">
                  <!-- App Header -->
                  <div class="app-header">
                    <span class="titulo-kengo text-primary text-xl">KENGO</span>
                  </div>

                  <!-- Activity Card Preview -->
                  <div class="activity-preview">
                    <div class="activity-wave-bg"></div>
                    <div class="activity-content-preview">
                      <div class="activity-badge-preview">
                        <span class="badge-number">4</span>
                        <span class="badge-label">ejercicios</span>
                      </div>
                      <h3 class="activity-title-preview">
                        Tu actividad de hoy
                      </h3>
                      <p class="activity-subtitle-preview">
                        Plan de rehabilitacion lumbar
                      </p>
                      <div class="progress-preview">
                        <div class="progress-bar-preview">
                          <div
                            class="progress-fill-preview"
                            style="width: 75%"
                          ></div>
                        </div>
                        <span class="progress-text-preview">75%</span>
                      </div>
                      <button class="cta-preview">
                        <svg
                          class="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Continuar sesion
                      </button>
                    </div>
                  </div>

                  <!-- Quick Actions -->
                  <div class="quick-actions-preview">
                    @for (action of quickActions; track action.id) {
                      <div class="action-card-preview">
                        <div class="action-icon-preview">
                          @switch (action.id) {
                            @case ('planes') {
                              <svg
                                class="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#e75c3e"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <rect
                                  x="4"
                                  y="3"
                                  width="16"
                                  height="18"
                                  rx="2"
                                />
                                <path d="M8 7h8" />
                                <path d="M8 11h8" />
                                <path d="M8 15h5" />
                              </svg>
                            }
                            @case ('ejercicios') {
                              <svg
                                class="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#e75c3e"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <rect
                                  x="2"
                                  y="4"
                                  width="20"
                                  height="16"
                                  rx="3"
                                />
                                <polygon
                                  points="10,8 16,12 10,16"
                                  fill="#e75c3e"
                                  stroke="none"
                                />
                              </svg>
                            }
                            @case ('progreso') {
                              <svg
                                class="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#e75c3e"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <path d="M3 3v18h18" />
                                <path d="M7 16l4-4 4 4 5-6" />
                              </svg>
                            }
                            @case ('fisio') {
                              <svg
                                class="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#e75c3e"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <circle cx="12" cy="6" r="4" />
                                <path d="M12 10v8" />
                                <path d="M8 14h8" />
                              </svg>
                            }
                          }
                        </div>
                        <span class="action-title-preview">{{
                          action.title
                        }}</span>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Floating Cards -->
              <div class="floating-card floating-card-1">
                <div class="floating-icon bg-green-100 text-green-600">
                  <svg
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div class="floating-text">
                  <span class="floating-title">Sesion completada</span>
                  <span class="floating-subtitle">Racha: 7 dias</span>
                </div>
              </div>

              <div class="floating-card floating-card-2">
                <div class="floating-icon bg-primary/10 text-primary">
                  <svg
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div class="floating-text">
                  <span class="floating-title">Video guiado</span>
                  <span class="floating-subtitle">HD profesional</span>
                </div>
              </div>

              <div class="floating-card floating-card-3">
                <div class="floating-icon bg-tertiary/20 text-tertiary">
                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                    />
                  </svg>
                </div>
                <div class="floating-text">
                  <span class="floating-title">Feedback</span>
                  <span class="floating-subtitle">Tu fisio te ayuda</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scroll Indicator -->
      <div
        class="animate-in absolute bottom-8 left-1/2 z-20 -translate-x-1/2 delay-500"
      >
        <a
          href="#beneficios"
          class="hover:text-primary flex flex-col items-center gap-2 text-gray-500 transition-colors"
        >
          <span class="text-xs font-medium tracking-wide uppercase"
            >Descubre mas</span
          >
          <div class="scroll-indicator">
            <div class="scroll-dot"></div>
          </div>
        </a>
      </div>

      <!-- Top Morphing Wave -->
      <svg
        class="wave-layer wave-top pointer-events-none absolute bottom-0 z-10 rotate-180"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <path fill="#fdd6b3" fill-opacity="1">
          <animate
            attributeName="d"
            dur="20s"
            repeatCount="indefinite"
            values="
                M0,140 C360,220 720,60 1080,200 C1260,260 1440,120 1440,120 L1440,0 L0,0 Z;
                M0,100 C360,40 720,220 1080,80 C1260,20 1440,160 1440,160 L1440,0 L0,0 Z;
                M0,160 C360,80 720,240 1080,100 C1260,40 1440,140 1440,140 L1440,0 L0,0 Z;
                M0,140 C360,220 720,60 1080,200 C1260,260 1440,120 1440,120 L1440,0 L0,0 Z
              "
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
          />
        </path>
      </svg>
    </section>
  `,
  styles: [
    `
      .hero-section {
        background: linear-gradient(180deg, #fffaf7 0%, #fff5ef 100%);
      }

      .hero-highlight {
        display: inline-block;
      }

      .highlight-underline {
        height: 12px;
        opacity: 0.8;
      }

      /* Phone Mockup */
      .hero-visual-container {
        position: relative;
        width: 100%;
        max-width: 400px;
        margin: 0 auto;
      }

      .phone-mockup {
        position: relative;
        width: 280px;
        height: 500px;
        margin: 0 auto;
        background: linear-gradient(145deg, #ffffff 0%, #f8f8f8 100%);
        border-radius: 40px;
        padding: 12px;
        box-shadow:
          0 50px 100px -20px rgba(0, 0, 0, 0.15),
          0 30px 60px -30px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.8);
        border: 1px solid rgba(0, 0, 0, 0.05);
      }

      .phone-screen {
        width: 100%;
        height: 100%;
        background: linear-gradient(180deg, #fffaf7 0%, #fff0e6 100%);
        border-radius: 32px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .app-header {
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .activity-preview {
        position: relative;
        margin: 0 16px;
        padding: 20px;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.4);
        overflow: hidden;
      }

      .activity-wave-bg {
        position: absolute;
        top: -20px;
        right: -20px;
        width: 120px;
        height: 120px;
        background: radial-gradient(
          circle,
          rgba(231, 92, 62, 0.25) 0%,
          transparent 70%
        );
        filter: blur(20px);
        animation: waveFloat 8s ease-in-out infinite;
      }

      @keyframes waveFloat {
        0%,
        100% {
          transform: translate(0, 0) scale(1);
        }
        50% {
          transform: translate(-10px, 10px) scale(1.1);
        }
      }

      .activity-content-preview {
        position: relative;
        z-index: 1;
      }

      .activity-badge-preview {
        position: absolute;
        top: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 12px;
        background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(231, 92, 62, 0.35);
      }

      .badge-number {
        font-size: 18px;
        font-weight: 700;
        color: white;
        line-height: 1;
      }

      .badge-label {
        font-size: 8px;
        color: rgba(255, 255, 255, 0.8);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .activity-title-preview {
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
        margin: 0 0 4px;
      }

      .activity-subtitle-preview {
        font-size: 12px;
        color: #6b7280;
        margin: 0 0 16px;
      }

      .progress-preview {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .progress-bar-preview {
        flex: 1;
        height: 6px;
        background: rgba(0, 0, 0, 0.08);
        border-radius: 3px;
        overflow: hidden;
      }

      .progress-fill-preview {
        height: 100%;
        background: linear-gradient(90deg, #e75c3e 0%, #efc048 100%);
        border-radius: 3px;
        transition: width 1s ease-out;
      }

      .progress-text-preview {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
      }

      .cta-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
        border: none;
        border-radius: 12px;
        color: white;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(231, 92, 62, 0.3);
      }

      .quick-actions-preview {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        padding: 20px 16px;
      }

      .action-card-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 16px 12px;
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.4);
        border-radius: 16px;
      }

      .action-icon-preview {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(
          135deg,
          rgba(231, 92, 62, 0.1) 0%,
          rgba(239, 192, 72, 0.08) 100%
        );
        border-radius: 12px;
        font-size: 20px;
      }

      .action-title-preview {
        font-size: 11px;
        font-weight: 500;
        color: #4b5563;
        text-align: center;
      }

      /* Floating Cards */
      .floating-card {
        position: absolute;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        animation: floatCard 6s ease-in-out infinite;
      }

      .floating-card-1 {
        top: 60px;
        right: -40px;
        animation-delay: 0s;
      }

      .floating-card-2 {
        top: 50%;
        left: -60px;
        animation-delay: -2s;
      }

      .floating-card-3 {
        bottom: 100px;
        right: -30px;
        animation-delay: -4s;
      }

      @keyframes floatCard {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-10px);
        }
      }

      .floating-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
      }

      .floating-text {
        display: flex;
        flex-direction: column;
      }

      .floating-title {
        font-size: 13px;
        font-weight: 600;
        color: #1f2937;
      }

      .floating-subtitle {
        font-size: 11px;
        color: #6b7280;
      }

      /* Scroll Indicator */
      .scroll-indicator {
        width: 24px;
        height: 40px;
        border: 2px solid currentColor;
        border-radius: 12px;
        position: relative;
      }

      .scroll-dot {
        width: 4px;
        height: 8px;
        background: currentColor;
        border-radius: 2px;
        position: absolute;
        top: 6px;
        left: 50%;
        transform: translateX(-50%);
        animation: scrollBounce 1.5s ease-in-out infinite;
      }

      @keyframes scrollBounce {
        0%,
        100% {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
        50% {
          transform: translateX(-50%) translateY(12px);
          opacity: 0.3;
        }
      }

      /* Responsive */
      @media (max-width: 1023px) {
        .phone-mockup {
          width: 240px;
          height: 500px;
        }

        .floating-card {
          display: none;
        }
      }

      /* ============================================
       MOBILE APP PREVIEW
    ============================================ */

      .mobile-app-preview {
        background: white;
        border-radius: 24px;
        overflow: hidden;
        border: 1px solid rgba(0, 0, 0, 0.06);
        box-shadow:
          0 16px 48px rgba(231, 92, 62, 0.12),
          0 4px 16px rgba(0, 0, 0, 0.06);
      }

      .mobile-app-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      }

      .mobile-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e75c3e, #c94a2f);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .mobile-today-card {
        padding: 20px;
        background: linear-gradient(
          135deg,
          rgba(231, 92, 62, 0.06),
          rgba(239, 192, 72, 0.04)
        );
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      }

      .mobile-today-label {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
      }

      .mobile-today-plan {
        font-size: 15px;
        font-weight: 700;
        color: #1f2937;
        margin-bottom: 12px;
      }

      .mobile-progress-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }

      .mobile-progress-bar {
        flex: 1;
        height: 8px;
        background: rgba(231, 92, 62, 0.12);
        border-radius: 4px;
        overflow: hidden;
      }

      .mobile-progress-fill {
        width: 75%;
        height: 100%;
        background: linear-gradient(90deg, #e75c3e, #efc048);
        border-radius: 4px;
      }

      .mobile-progress-text {
        font-size: 13px;
        font-weight: 700;
        color: #e75c3e;
      }

      .mobile-continue-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        background: linear-gradient(135deg, #e75c3e, #c94a2f);
        color: white;
        font-size: 14px;
        font-weight: 600;
        border-radius: 12px;
      }

      .mobile-actions-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        padding: 16px;
        gap: 8px;
      }

      .mobile-action {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }

      .mobile-action-icon {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: rgba(231, 92, 62, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .mobile-action-label {
        font-size: 10px;
        font-weight: 600;
        color: #6b7280;
        text-align: center;
      }

      .mobile-floating-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 12px;
        padding: 10px 16px;
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.2);
        border-radius: 100px;
        font-size: 13px;
        font-weight: 600;
        color: #15803d;
      }

      .mobile-badge-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #22c55e;
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.6;
          transform: scale(0.85);
        }
      }
    `,
  ],
})
export class HeroComponent {
  quickActions = [
    { id: 'planes', title: 'Mis planes' },
    { id: 'ejercicios', title: 'Ejercicios' },
    { id: 'progreso', title: 'Progreso' },
    { id: 'fisio', title: 'Mi fisio' },
  ];
}
