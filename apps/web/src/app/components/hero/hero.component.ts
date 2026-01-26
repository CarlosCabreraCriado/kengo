import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-hero',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="hero-section relative min-h-screen flex items-center overflow-hidden">
      <!-- Aurora Background -->
      <div class="aurora-bg">
        <div class="aurora-wave aurora-wave-1"></div>
        <div class="aurora-wave aurora-wave-2"></div>
        <div class="aurora-wave aurora-wave-3"></div>
        <div class="aurora-wave aurora-wave-4"></div>
      </div>

      <!-- Subtle Pattern Overlay -->
      <div class="absolute inset-0 pattern-dots opacity-30 z-[1]"></div>

      <!-- Gradient Overlay -->
      <div class="absolute inset-0 kengo-gradient-subtle z-[2]"></div>

      <!-- Content -->
      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 w-full">
        <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <!-- Text Content -->
          <div class="text-center lg:text-left">
            <!-- Badge -->
            <div class="animate-in inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 mb-8">
              <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span class="text-sm font-medium text-gray-700">+500 ejercicios disponibles</span>
            </div>

            <!-- Headline -->
            <h1 class="animate-in delay-100 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-tight tracking-tight">
              Tu tratamiento de
              <span class="hero-highlight relative inline-block">
                <span class="relative z-10 text-primary">fisioterapia</span>
                <svg class="highlight-underline absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" preserveAspectRatio="none">
                  <path d="M0,8 Q50,0 100,8 T200,8" fill="none" stroke="url(#gradient)" stroke-width="4" stroke-linecap="round"/>
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#e75c3e"/>
                      <stop offset="100%" stop-color="#efc048"/>
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              <br class="hidden sm:block" />
              siempre contigo
            </h1>

            <!-- Subtitle -->
            <p class="animate-in delay-200 mt-6 text-lg sm:text-xl text-gray-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Planes de ejercicios personalizados con videos guiados, seguimiento de progreso y
              <span class="font-semibold text-gray-800">conexion directa con tu fisioterapeuta</span>.
            </p>

            <!-- CTAs -->
            <div class="animate-in delay-300 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mt-10">
              <a
                href="https://app.kengoapp.com/registro"
                class="btn-kengo text-lg group"
              >
                <span>Empieza gratis</span>
                <svg class="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a
                href="https://app.kengoapp.com/registro"
                class="btn-kengo-secondary text-lg"
              >
                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Soy fisioterapeuta</span>
              </a>
            </div>

            <!-- Trust Indicators -->
            <div class="animate-in delay-400 mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-8">
              <div class="flex items-center gap-2">
                <div class="flex -space-x-2">
                  @for (i of [1, 2, 3, 4]; track i) {
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-tertiary border-2 border-white flex items-center justify-center">
                      <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                      </svg>
                    </div>
                  }
                </div>
                <span class="text-sm text-gray-600">
                  <span class="font-semibold text-gray-900">+1.000</span> pacientes activos
                </span>
              </div>
              <div class="flex items-center gap-2">
                <div class="flex">
                  @for (i of [1, 2, 3, 4, 5]; track i) {
                    <svg class="w-5 h-5 text-tertiary" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  }
                </div>
                <span class="text-sm text-gray-600">
                  <span class="font-semibold text-gray-900">4.9</span> valoracion media
                </span>
              </div>
            </div>
          </div>

          <!-- Visual Element -->
          <div class="animate-in delay-200 relative hidden lg:block">
            <div class="hero-visual-container relative">
              <!-- Phone Mockup -->
              <div class="phone-mockup animate-float">
                <div class="phone-screen">
                  <!-- App Header -->
                  <div class="app-header">
                    <span class="titulo-kengo text-xl text-primary">KENGO</span>
                  </div>

                  <!-- Activity Card Preview -->
                  <div class="activity-preview">
                    <div class="activity-wave-bg"></div>
                    <div class="activity-content-preview">
                      <div class="activity-badge-preview">
                        <span class="badge-number">4</span>
                        <span class="badge-label">ejercicios</span>
                      </div>
                      <h3 class="activity-title-preview">Tu actividad de hoy</h3>
                      <p class="activity-subtitle-preview">Plan de rehabilitacion lumbar</p>
                      <div class="progress-preview">
                        <div class="progress-bar-preview">
                          <div class="progress-fill-preview" style="width: 75%"></div>
                        </div>
                        <span class="progress-text-preview">75%</span>
                      </div>
                      <button class="cta-preview">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Continuar sesion
                      </button>
                    </div>
                  </div>

                  <!-- Quick Actions -->
                  <div class="quick-actions-preview">
                    @for (action of quickActions; track action.title) {
                      <div class="action-card-preview">
                        <div class="action-icon-preview">
                          <span>{{ action.icon }}</span>
                        </div>
                        <span class="action-title-preview">{{ action.title }}</span>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Floating Cards -->
              <div class="floating-card floating-card-1">
                <div class="floating-icon bg-green-100 text-green-600">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div class="floating-text">
                  <span class="floating-title">Sesion completada</span>
                  <span class="floating-subtitle">Racha: 7 dias</span>
                </div>
              </div>

              <div class="floating-card floating-card-2">
                <div class="floating-icon bg-primary/10 text-primary">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="floating-text">
                  <span class="floating-title">Video guiado</span>
                  <span class="floating-subtitle">HD profesional</span>
                </div>
              </div>

              <div class="floating-card floating-card-3">
                <div class="floating-icon bg-tertiary/20 text-tertiary">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <div class="floating-text">
                  <span class="floating-title">Feedback</span>
                  <span class="floating-subtitle">Tu fisio lo ve</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scroll Indicator -->
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-in delay-500">
        <a href="#beneficios" class="flex flex-col items-center gap-2 text-gray-500 hover:text-primary transition-colors">
          <span class="text-xs font-medium tracking-wide uppercase">Descubre mas</span>
          <div class="scroll-indicator">
            <div class="scroll-dot"></div>
          </div>
        </a>
      </div>
    </section>
  `,
  styles: [`
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
      height: 580px;
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
      background: radial-gradient(circle, rgba(231, 92, 62, 0.25) 0%, transparent 70%);
      filter: blur(20px);
      animation: waveFloat 8s ease-in-out infinite;
    }

    @keyframes waveFloat {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-10px, 10px) scale(1.1); }
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
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.1) 0%, rgba(239, 192, 72, 0.08) 100%);
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
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
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
      0%, 100% { transform: translateX(-50%) translateY(0); opacity: 1; }
      50% { transform: translateX(-50%) translateY(12px); opacity: 0.3; }
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
  `]
})
export class HeroComponent {
  quickActions = [
    { icon: '📋', title: 'Mis planes' },
    { icon: '🎬', title: 'Ejercicios' },
    { icon: '📊', title: 'Progreso' },
    { icon: '👨‍⚕️', title: 'Mi fisio' },
  ];
}
