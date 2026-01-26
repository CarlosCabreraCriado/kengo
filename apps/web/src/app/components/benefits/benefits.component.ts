import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-benefits',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="beneficios" class="benefits-section relative py-24 lg:py-32 overflow-hidden">
      <!-- Background Elements -->
      <div class="absolute inset-0 kengo-gradient-subtle"></div>
      <div class="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/50 to-transparent"></div>

      <!-- Decorative Elements -->
      <div class="absolute top-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"></div>
      <div class="absolute bottom-20 left-10 w-96 h-96 bg-tertiary/5 rounded-full blur-3xl"></div>

      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center max-w-3xl mx-auto mb-16 lg:mb-20">
          <span class="animate-in inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            Para todos los roles
          </span>
          <h2 class="animate-in delay-100 section-title-kengo mb-6">
            Beneficios que transforman la
            <span class="text-primary">rehabilitacion</span>
          </h2>
          <p class="animate-in delay-200 text-lg text-gray-600 leading-relaxed">
            Kengo mejora la experiencia de pacientes, fisioterapeutas y clinicas con herramientas disenadas para maximizar resultados.
          </p>
        </div>

        <!-- Benefits Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          @for (segment of segments; track segment.title; let i = $index) {
            <div
              class="animate-in benefit-card group"
              [style.animation-delay]="(i * 0.15) + 's'"
            >
              <!-- Card Glow Effect -->
              <div class="card-glow" [style.background]="segment.glowColor"></div>

              <!-- Card Content -->
              <div class="relative z-10">
                <!-- Icon -->
                <div class="benefit-icon-wrapper" [style.background]="segment.iconBg">
                  <span class="text-4xl">{{ segment.icon }}</span>
                </div>

                <!-- Title & Tag -->
                <div class="flex items-center gap-3 mb-4">
                  <h3 class="text-2xl font-bold text-gray-900">{{ segment.title }}</h3>
                  <span
                    class="px-2.5 py-1 rounded-full text-xs font-semibold"
                    [style.background]="segment.tagBg"
                    [style.color]="segment.tagColor"
                  >
                    {{ segment.tag }}
                  </span>
                </div>

                <!-- Description -->
                <p class="text-gray-600 mb-6">{{ segment.description }}</p>

                <!-- Benefits List -->
                <ul class="space-y-3">
                  @for (benefit of segment.benefits; track benefit.text) {
                    <li class="benefit-item">
                      <div class="benefit-check" [style.background]="segment.checkBg">
                        <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div class="flex-1">
                        <span class="text-gray-800 font-medium">{{ benefit.text }}</span>
                        @if (benefit.highlight) {
                          <span class="ml-2 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            {{ benefit.highlight }}
                          </span>
                        }
                      </div>
                    </li>
                  }
                </ul>

                <!-- CTA Link -->
                <a
                  [href]="segment.ctaLink"
                  class="benefit-cta group/cta mt-6"
                  [style.color]="segment.ctaColor"
                >
                  <span>{{ segment.cta }}</span>
                  <svg class="w-4 h-4 transition-transform group-hover/cta:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .benefits-section {
      background: linear-gradient(180deg, #ffffff 0%, #fffaf7 100%);
    }

    .benefit-card {
      position: relative;
      padding: 32px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 28px;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .benefit-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
    }

    .card-glow {
      position: absolute;
      top: -50%;
      right: -50%;
      width: 200%;
      height: 200%;
      opacity: 0;
      filter: blur(80px);
      transition: opacity 0.4s ease;
      pointer-events: none;
    }

    .benefit-card:hover .card-glow {
      opacity: 0.15;
    }

    .benefit-icon-wrapper {
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 24px;
      margin-bottom: 24px;
      transition: transform 0.3s ease;
    }

    .benefit-card:hover .benefit-icon-wrapper {
      transform: scale(1.05) rotate(-3deg);
    }

    .benefit-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .benefit-check {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      margin-top: 2px;
    }

    .benefit-cta {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .benefit-cta:hover {
      opacity: 0.8;
    }
  `]
})
export class BenefitsComponent {
  segments = [
    {
      icon: '🧘',
      title: 'Para Pacientes',
      tag: 'Gratis',
      tagBg: 'rgba(34, 197, 94, 0.1)',
      tagColor: '#16a34a',
      iconBg: 'linear-gradient(135deg, rgba(231, 92, 62, 0.15) 0%, rgba(255, 180, 164, 0.1) 100%)',
      glowColor: 'radial-gradient(circle, rgba(231, 92, 62, 0.3) 0%, transparent 70%)',
      checkBg: 'linear-gradient(135deg, #e75c3e 0%, #f97316 100%)',
      ctaColor: '#e75c3e',
      cta: 'Empezar ahora',
      ctaLink: 'https://app.kengoapp.com/registro',
      description: 'Tu fisio siempre contigo, guiandote en cada ejercicio desde casa.',
      benefits: [
        { text: 'Ejercicios con video HD profesional', highlight: null },
        { text: 'Sabe exactamente que hacer cada dia', highlight: null },
        { text: 'Registra como te sientes', highlight: 'Nuevo' },
        { text: 'Tu fisio siempre informado', highlight: null },
      ],
    },
    {
      icon: '👨‍⚕️',
      title: 'Para Fisioterapeutas',
      tag: 'Pro',
      tagBg: 'rgba(231, 92, 62, 0.1)',
      tagColor: '#e75c3e',
      iconBg: 'linear-gradient(135deg, rgba(239, 192, 72, 0.2) 0%, rgba(255, 220, 150, 0.1) 100%)',
      glowColor: 'radial-gradient(circle, rgba(239, 192, 72, 0.3) 0%, transparent 70%)',
      checkBg: 'linear-gradient(135deg, #efc048 0%, #f59e0b 100%)',
      ctaColor: '#d97706',
      cta: 'Crear cuenta',
      ctaLink: 'https://app.kengoapp.com/registro',
      description: 'Herramientas profesionales para gestionar pacientes de forma eficiente.',
      benefits: [
        { text: 'Crea planes en minutos, no horas', highlight: null },
        { text: '+500 ejercicios en el catalogo', highlight: 'HD' },
        { text: 'Monitoriza adherencia real', highlight: null },
        { text: 'Plantillas reutilizables', highlight: null },
      ],
    },
    {
      icon: '🏥',
      title: 'Para Clinicas',
      tag: 'Enterprise',
      tagBg: 'rgba(99, 102, 241, 0.1)',
      tagColor: '#6366f1',
      iconBg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(165, 180, 252, 0.1) 100%)',
      glowColor: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)',
      checkBg: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      ctaColor: '#6366f1',
      cta: 'Contactar ventas',
      ctaLink: 'https://app.kengoapp.com/registro',
      description: 'Escala tu clinica con gestion centralizada y marca personalizada.',
      benefits: [
        { text: 'Gestion centralizada del equipo', highlight: null },
        { text: 'Codigos de acceso seguros', highlight: null },
        { text: 'Tu marca, tu identidad', highlight: 'Branding' },
        { text: 'Escala sin complicaciones', highlight: null },
      ],
    },
  ];
}
