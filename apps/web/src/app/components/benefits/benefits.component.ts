import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-benefits',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="beneficios" class="py-20 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Beneficios para todos
          </h2>
          <p class="text-xl text-gray-600 max-w-2xl mx-auto">
            Kengo mejora la experiencia de pacientes, fisioterapeutas y clinicas.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          @for (segment of segments; track segment.title) {
            <div class="tarjeta-kengo rounded-2xl p-8">
              <div class="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <span class="text-3xl">{{ segment.icon }}</span>
              </div>
              <h3 class="text-2xl font-bold text-gray-900 mb-4">{{ segment.title }}</h3>
              <ul class="space-y-3">
                @for (benefit of segment.benefits; track benefit) {
                  <li class="flex items-start gap-3">
                    <span class="text-primary mt-1">✓</span>
                    <span class="text-gray-600">{{ benefit }}</span>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class BenefitsComponent {
  segments = [
    {
      icon: '🧘',
      title: 'Para Pacientes',
      benefits: [
        'Ejercicios con video HD profesional',
        'Sabe exactamente que hacer cada dia',
        'Registra como te sientes',
        'Tu fisio siempre informado',
      ],
    },
    {
      icon: '👨‍⚕️',
      title: 'Para Fisioterapeutas',
      benefits: [
        'Crea planes en minutos, no horas',
        '+500 ejercicios en el catalogo',
        'Monitoriza adherencia real',
        'Plantillas reutilizables',
      ],
    },
    {
      icon: '🏥',
      title: 'Para Clinicas',
      benefits: [
        'Gestion centralizada del equipo',
        'Codigos de acceso seguros',
        'Tu marca, tu identidad',
        'Escala sin complicaciones',
      ],
    },
  ];
}
