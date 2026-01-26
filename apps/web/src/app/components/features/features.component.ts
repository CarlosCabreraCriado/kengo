import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-features',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="features" class="features-section relative py-24 lg:py-32 overflow-hidden">
      <!-- Background -->
      <div class="absolute inset-0 bg-gradient-to-b from-white via-gray-50/50 to-white"></div>

      <!-- Decorative Elements -->
      <div class="absolute top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      <div class="absolute bottom-1/4 left-0 w-80 h-80 bg-tertiary/5 rounded-full blur-3xl"></div>

      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center max-w-3xl mx-auto mb-16 lg:mb-20">
          <span class="animate-in inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            Funcionalidades
          </span>
          <h2 class="animate-in delay-100 section-title-kengo mb-6">
            Todo lo que necesitas para
            <span class="text-primary">mejorar</span>
          </h2>
          <p class="animate-in delay-200 text-lg text-gray-600 leading-relaxed">
            Herramientas disenadas para mejorar la adherencia y el seguimiento de tratamientos de fisioterapia.
          </p>
        </div>

        <!-- Features Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          @for (feature of features; track feature.id; let i = $index) {
            <div
              class="animate-in feature-card group"
              [style.animation-delay]="(i * 0.1) + 's'"
            >
              <!-- Icon -->
              <div class="feature-icon-wrapper" [class]="feature.iconClass">
                @switch (feature.id) {
                  @case ('videos') {
                    <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#e75c3e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="3"/>
                      <polygon points="10,8 16,12 10,16" fill="#e75c3e" stroke="none"/>
                    </svg>
                  }
                  @case ('planes') {
                    <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="4" y="3" width="16" height="18" rx="2"/>
                      <path d="M8 7h8"/>
                      <path d="M8 11h8"/>
                      <path d="M8 15h5"/>
                      <path d="M16 15l2 2 4-4" stroke="#22c55e"/>
                    </svg>
                  }
                  @case ('seguimiento') {
                    <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 3v18h18"/>
                      <path d="M7 16l4-4 4 4 5-6"/>
                      <circle cx="20" cy="6" r="2" fill="#22c55e" stroke="none"/>
                    </svg>
                  }
                  @case ('recordatorios') {
                    <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      <circle cx="18" cy="5" r="3" fill="#ef4444" stroke="#ef4444"/>
                    </svg>
                  }
                  @case ('multiclinica') {
                    <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="8" width="7" height="13" rx="1"/>
                      <rect x="14" y="8" width="7" height="13" rx="1"/>
                      <path d="M6.5 5a2.5 2.5 0 0 1 5 0v3h-5V5z"/>
                      <path d="M12.5 5a2.5 2.5 0 0 1 5 0v3h-5V5z"/>
                      <path d="M12 12v4" stroke-dasharray="2 2"/>
                    </svg>
                  }
                  @case ('codigos') {
                    <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="11" width="18" height="10" rx="2"/>
                      <circle cx="12" cy="16" r="2"/>
                      <path d="M12 14v-2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  }
                }
              </div>

              <!-- Content -->
              <div class="feature-content">
                <h3 class="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                  {{ feature.title }}
                </h3>
                <p class="text-gray-600 text-sm leading-relaxed">
                  {{ feature.description }}
                </p>
              </div>

              <!-- Stats Badge (if available) -->
              @if (feature.stat) {
                <div class="feature-stat">
                  <span class="stat-value">{{ feature.stat.value }}</span>
                  <span class="stat-label">{{ feature.stat.label }}</span>
                </div>
              }

              <!-- Hover Gradient -->
              <div class="feature-gradient"></div>
            </div>
          }
        </div>

        <!-- Bottom Feature Highlight -->
        <div class="animate-in delay-600 mt-16 lg:mt-20">
          <div class="highlight-card">
            <div class="highlight-content">
              <div class="highlight-badge">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div class="highlight-text">
                <h3 class="text-2xl font-bold text-white mb-2">
                  Experiencia movil nativa
                </h3>
                <p class="text-white/80">
                  Disenado mobile-first para que tus pacientes tengan la mejor experiencia desde cualquier dispositivo. Instalable como app, funciona sin conexion.
                </p>
              </div>
              <div class="highlight-cta">
                <a href="https://app.kengoapp.com/registro" class="btn-kengo-secondary !bg-white !text-gray-900">
                  Probar gratis
                </a>
              </div>
            </div>

            <!-- Decorative Elements -->
            <div class="highlight-decoration">
              <div class="decoration-circle decoration-circle-1"></div>
              <div class="decoration-circle decoration-circle-2"></div>
              <div class="decoration-circle decoration-circle-3"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .features-section {
      background: #ffffff;
    }

    .feature-card {
      position: relative;
      padding: 28px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 0, 0, 0.04);
      border-radius: 24px;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .feature-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
      border-color: rgba(231, 92, 62, 0.15);
    }

    .feature-icon-wrapper {
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 20px;
      margin-bottom: 20px;
      transition: transform 0.3s ease;
    }

    .feature-card:hover .feature-icon-wrapper {
      transform: scale(1.1) rotate(-5deg);
    }

    .icon-coral {
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.15) 0%, rgba(255, 180, 164, 0.1) 100%);
    }

    .icon-gold {
      background: linear-gradient(135deg, rgba(239, 192, 72, 0.2) 0%, rgba(255, 220, 150, 0.1) 100%);
    }

    .icon-green {
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(134, 239, 172, 0.1) 100%);
    }

    .icon-blue {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 197, 253, 0.1) 100%);
    }

    .icon-purple {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(196, 181, 253, 0.1) 100%);
    }

    .icon-pink {
      background: linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(249, 168, 212, 0.1) 100%);
    }

    .feature-content {
      position: relative;
      z-index: 1;
    }

    .feature-stat {
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      margin-top: 16px;
      padding: 6px 12px;
      background: rgba(231, 92, 62, 0.08);
      border-radius: 20px;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 700;
      color: #e75c3e;
    }

    .stat-label {
      font-size: 12px;
      color: #e75c3e;
      opacity: 0.8;
    }

    .feature-gradient {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 50%;
      background: linear-gradient(to top, rgba(231, 92, 62, 0.03), transparent);
      opacity: 0;
      transition: opacity 0.4s ease;
      pointer-events: none;
    }

    .feature-card:hover .feature-gradient {
      opacity: 1;
    }

    /* Highlight Card */
    .highlight-card {
      position: relative;
      padding: 48px;
      background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 50%, #a73d25 100%);
      border-radius: 32px;
      overflow: hidden;
    }

    .highlight-content {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 32px;
    }

    @media (max-width: 1023px) {
      .highlight-content {
        grid-template-columns: 1fr;
        text-align: center;
      }

      .highlight-badge {
        margin: 0 auto;
      }

      .highlight-cta {
        justify-content: center;
      }
    }

    .highlight-badge {
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      backdrop-filter: blur(8px);
    }

    .highlight-text {
      max-width: 600px;
    }

    .highlight-cta {
      display: flex;
      align-items: center;
    }

    .highlight-decoration {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }

    .decoration-circle {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
    }

    .decoration-circle-1 {
      width: 300px;
      height: 300px;
      top: -100px;
      right: -50px;
      animation: float1 15s ease-in-out infinite;
    }

    .decoration-circle-2 {
      width: 200px;
      height: 200px;
      bottom: -80px;
      left: 20%;
      animation: float2 18s ease-in-out infinite;
    }

    .decoration-circle-3 {
      width: 150px;
      height: 150px;
      top: 50%;
      right: 30%;
      animation: float3 12s ease-in-out infinite;
    }

    @keyframes float1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-30px, 20px) scale(1.1); }
    }

    @keyframes float2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(20px, -30px) scale(1.05); }
    }

    @keyframes float3 {
      0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
      50% { transform: translate(-15px, 15px) scale(1.15); opacity: 0.8; }
    }
  `]
})
export class FeaturesComponent {
  features = [
    {
      id: 'videos',
      title: 'Videos profesionales',
      description: 'Mas de 500 ejercicios grabados por fisioterapeutas con instrucciones claras y demostraciones en HD.',
      iconClass: 'icon-coral',
      stat: { value: '+500', label: 'ejercicios' },
    },
    {
      id: 'planes',
      title: 'Planes personalizados',
      description: 'Ejercicios adaptados a tu lesion y horario, asignados por dias de la semana segun tus necesidades.',
      iconClass: 'icon-gold',
      stat: null,
    },
    {
      id: 'seguimiento',
      title: 'Seguimiento de dolor',
      description: 'Registra como te sientes en cada sesion para que tu fisio ajuste el tratamiento de forma precisa.',
      iconClass: 'icon-green',
      stat: null,
    },
    {
      id: 'recordatorios',
      title: 'Recordatorios',
      description: 'Nunca olvides tu rutina de ejercicios gracias a las notificaciones diarias personalizadas.',
      iconClass: 'icon-blue',
      stat: null,
    },
    {
      id: 'multiclinica',
      title: 'Multi-clinica',
      description: 'Un fisioterapeuta puede gestionar varias clinicas y pacientes desde una sola cuenta profesional.',
      iconClass: 'icon-purple',
      stat: null,
    },
    {
      id: 'codigos',
      title: 'Codigos de acceso',
      description: 'Invita pacientes de forma segura con codigos unicos de 8 caracteres, sin compartir datos sensibles.',
      iconClass: 'icon-pink',
      stat: null,
    },
  ];
}
