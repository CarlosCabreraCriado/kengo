import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-cta',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="cta-section relative py-24 lg:py-32 overflow-hidden">
      <!-- Background Gradient -->
      <div class="absolute inset-0 kengo-gradient"></div>

      <!-- Aurora Waves -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="cta-wave cta-wave-1"></div>
        <div class="cta-wave cta-wave-2"></div>
        <div class="cta-wave cta-wave-3"></div>
      </div>

      <!-- Pattern Overlay -->
      <div class="absolute inset-0 pattern-dots opacity-20"></div>

      <div class="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <!-- Badge -->
        <div class="animate-in inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 mb-8">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span class="text-sm font-medium text-gray-700">Disponible ahora</span>
        </div>

        <!-- Title -->
        <h2 class="animate-in delay-100 text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Empieza a mejorar la
          <span class="text-primary">adherencia</span>
          de tus pacientes hoy
        </h2>

        <!-- Subtitle -->
        <p class="animate-in delay-200 text-lg sm:text-xl text-gray-700 mb-10 max-w-2xl mx-auto leading-relaxed">
          Registrate gratis y transforma la forma en que tus pacientes siguen sus tratamientos de fisioterapia.
        </p>

        <!-- CTA Buttons -->
        <div class="animate-in delay-300 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://app.kengoapp.com/registro"
            class="btn-kengo text-lg group"
          >
            <span>Crear cuenta gratuita</span>
            <svg class="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          <a
            href="#como-funciona"
            class="btn-kengo-secondary text-lg"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Ver como funciona</span>
          </a>
        </div>

        <!-- Trust Badges -->
        <div class="animate-in delay-400 mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Sin tarjeta de credito</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Configuracion en 2 minutos</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Cancela cuando quieras</span>
          </div>
        </div>

        <!-- Floating Stats -->
        <div class="animate-in delay-500 mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          @for (stat of stats; track stat.label) {
            <div class="stat-card">
              <span class="stat-value">{{ stat.value }}</span>
              <span class="stat-label">{{ stat.label }}</span>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .cta-section {
      position: relative;
    }

    .cta-wave {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.4;
      mix-blend-mode: multiply;
    }

    .cta-wave-1 {
      width: 400px;
      height: 400px;
      top: -100px;
      left: -100px;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.5) 0%, transparent 70%);
      animation: ctaFloat1 15s ease-in-out infinite;
    }

    .cta-wave-2 {
      width: 350px;
      height: 350px;
      bottom: -100px;
      right: -100px;
      background: radial-gradient(circle, rgba(239, 192, 72, 0.4) 0%, transparent 70%);
      animation: ctaFloat2 18s ease-in-out infinite;
    }

    .cta-wave-3 {
      width: 300px;
      height: 300px;
      top: 50%;
      left: 60%;
      background: radial-gradient(circle, rgba(255, 180, 164, 0.3) 0%, transparent 70%);
      animation: ctaFloat3 12s ease-in-out infinite;
    }

    @keyframes ctaFloat1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(50px, 30px) scale(1.15); }
    }

    @keyframes ctaFloat2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-40px, -30px) scale(1.1); }
    }

    @keyframes ctaFloat3 {
      0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
      50% { transform: translate(-30px, 20px) scale(1.2); opacity: 0.5; }
    }

    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 16px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 20px;
      transition: all 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      background: rgba(255, 255, 255, 0.8);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #e75c3e;
      line-height: 1;
    }

    .stat-label {
      font-size: 13px;
      color: #6b7280;
      margin-top: 6px;
    }
  `]
})
export class CtaComponent {
  stats = [
    { value: '+500', label: 'Ejercicios' },
    { value: '+1.000', label: 'Pacientes' },
    { value: '4.9★', label: 'Valoracion' },
    { value: '95%', label: 'Adherencia' },
  ];
}
