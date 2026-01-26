import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-how-it-works',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="como-funciona" class="how-it-works-section relative py-24 lg:py-32 overflow-hidden">
      <!-- Background -->
      <div class="absolute inset-0 kengo-gradient"></div>

      <!-- Aurora Waves -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="aurora-wave-section aurora-wave-section-1"></div>
        <div class="aurora-wave-section aurora-wave-section-2"></div>
      </div>

      <!-- Pattern -->
      <div class="absolute inset-0 pattern-dots opacity-20"></div>

      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center max-w-3xl mx-auto mb-16 lg:mb-24">
          <span class="animate-in inline-block px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 text-gray-700 text-sm font-semibold mb-6">
            Facil de usar
          </span>
          <h2 class="animate-in delay-100 section-title-kengo mb-6">
            Como funciona
            <span class="text-primary">Kengo</span>
          </h2>
          <p class="animate-in delay-200 text-lg text-gray-700 leading-relaxed">
            En 4 sencillos pasos estaras siguiendo tu tratamiento de forma guiada, con feedback en tiempo real.
          </p>
        </div>

        <!-- Steps Grid -->
        <div class="steps-container">
          <!-- Connection Line (Desktop) -->
          <div class="connection-line hidden lg:block"></div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            @for (step of steps; track step.number; let i = $index) {
              <div
                class="animate-in step-card"
                [style.animation-delay]="(i * 0.15) + 's'"
              >
                <!-- Step Number Badge -->
                <div class="step-number-wrapper">
                  <div class="step-number">
                    <span>{{ step.number }}</span>
                  </div>
                  <!-- Pulse Ring -->
                  <div class="step-pulse"></div>
                </div>

                <!-- Card Content -->
                <div class="step-content">
                  <!-- Icon -->
                  <div class="step-icon">
                    <span class="text-4xl">{{ step.icon }}</span>
                  </div>

                  <!-- Text -->
                  <h3 class="text-xl font-bold text-gray-900 mb-3">{{ step.title }}</h3>
                  <p class="text-gray-600 text-sm leading-relaxed">{{ step.description }}</p>

                  <!-- Feature Tags -->
                  <div class="step-tags mt-4">
                    @for (tag of step.tags; track tag) {
                      <span class="step-tag">{{ tag }}</span>
                    }
                  </div>
                </div>

                <!-- Arrow (Mobile/Tablet) -->
                @if (i < steps.length - 1) {
                  <div class="step-arrow lg:hidden">
                    <svg class="w-6 h-6 text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Bottom CTA -->
        <div class="animate-in delay-600 text-center mt-16">
          <a
            href="https://app.kengoapp.com/registro"
            class="btn-kengo text-lg inline-flex"
          >
            <span>Empezar mi tratamiento</span>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          <p class="mt-4 text-sm text-gray-600">
            Sin tarjeta de credito • Configuracion en 2 minutos
          </p>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .how-it-works-section {
      position: relative;
    }

    .aurora-wave-section {
      position: absolute;
      border-radius: 50%;
      filter: blur(100px);
      opacity: 0.3;
      mix-blend-mode: multiply;
    }

    .aurora-wave-section-1 {
      width: 600px;
      height: 600px;
      top: -200px;
      left: -200px;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.4) 0%, transparent 70%);
      animation: floatWave1 20s ease-in-out infinite;
    }

    .aurora-wave-section-2 {
      width: 500px;
      height: 500px;
      bottom: -150px;
      right: -150px;
      background: radial-gradient(circle, rgba(239, 192, 72, 0.35) 0%, transparent 70%);
      animation: floatWave2 25s ease-in-out infinite;
    }

    @keyframes floatWave1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(50px, 30px) scale(1.1); }
    }

    @keyframes floatWave2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-40px, -20px) scale(1.15); }
    }

    .steps-container {
      position: relative;
    }

    .connection-line {
      position: absolute;
      top: 48px;
      left: calc(12.5% + 24px);
      right: calc(12.5% + 24px);
      height: 3px;
      background: linear-gradient(90deg,
        rgba(231, 92, 62, 0.3) 0%,
        rgba(231, 92, 62, 0.5) 33%,
        rgba(239, 192, 72, 0.5) 66%,
        rgba(239, 192, 72, 0.3) 100%
      );
      border-radius: 2px;
      z-index: 0;
    }

    .connection-line::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 30%;
      background: linear-gradient(90deg, rgba(231, 92, 62, 0.8), transparent);
      border-radius: 2px;
      animation: lineProgress 3s ease-in-out infinite;
    }

    @keyframes lineProgress {
      0% { left: -30%; opacity: 0; }
      50% { opacity: 1; }
      100% { left: 100%; opacity: 0; }
    }

    .step-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .step-number-wrapper {
      position: relative;
      z-index: 10;
      margin-bottom: 24px;
    }

    .step-number {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(231, 92, 62, 0.35);
      transition: all 0.3s ease;
    }

    .step-card:hover .step-number {
      transform: scale(1.1) rotate(-5deg);
      box-shadow: 0 8px 24px rgba(231, 92, 62, 0.45);
    }

    .step-number span {
      font-size: 20px;
      font-weight: 700;
      color: white;
    }

    .step-pulse {
      position: absolute;
      inset: -4px;
      border-radius: 20px;
      border: 2px solid rgba(231, 92, 62, 0.3);
      animation: pulse 2s ease-out infinite;
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.5; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    .step-content {
      padding: 28px 24px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      width: 100%;
    }

    .step-card:hover .step-content {
      transform: translateY(-8px);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12);
      background: rgba(255, 255, 255, 0.85);
    }

    .step-icon {
      width: 72px;
      height: 72px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.1) 0%, rgba(239, 192, 72, 0.08) 100%);
      border-radius: 20px;
      transition: transform 0.3s ease;
    }

    .step-card:hover .step-icon {
      transform: scale(1.1);
    }

    .step-tags {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
    }

    .step-tag {
      padding: 4px 10px;
      background: rgba(231, 92, 62, 0.08);
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      color: #e75c3e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .step-arrow {
      position: absolute;
      bottom: -32px;
      left: 50%;
      transform: translateX(-50%);
      animation: bounce 2s ease-in-out infinite;
    }

    @keyframes bounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(8px); }
    }

    @media (max-width: 767px) {
      .step-card {
        margin-bottom: 40px;
      }

      .step-card:last-child {
        margin-bottom: 0;
      }
    }
  `]
})
export class HowItWorksComponent {
  steps = [
    {
      number: 1,
      icon: '📋',
      title: 'El fisio crea tu plan',
      description: 'Selecciona ejercicios personalizados para tu lesion, adaptados a tu ritmo de vida y objetivos.',
      tags: ['Personalizado', 'Rapido'],
    },
    {
      number: 2,
      icon: '📱',
      title: 'Recibe tu actividad',
      description: 'Ve que ejercicios tocan cada dia con videos incluidos, directamente en tu movil.',
      tags: ['Notificaciones', 'Calendario'],
    },
    {
      number: 3,
      icon: '🎬',
      title: 'Sesion guiada',
      description: 'Sigue el video HD, las series y los descansos paso a paso. Como tener al fisio en casa.',
      tags: ['Video HD', 'Temporizador'],
    },
    {
      number: 4,
      icon: '💬',
      title: 'Feedback instantaneo',
      description: 'Registra como te sientes y tu fisio ajusta el tratamiento en tiempo real.',
      tags: ['Dolor', 'Progreso'],
    },
  ];
}
