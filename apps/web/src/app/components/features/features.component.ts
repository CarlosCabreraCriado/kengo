import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-features',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="features" class="py-20 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Funcionalidades que marcan la diferencia
          </h2>
          <p class="text-xl text-gray-600 max-w-2xl mx-auto">
            Herramientas disenadas para mejorar la adherencia y el seguimiento de tratamientos.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          @for (feature of features; track feature.title) {
            <div class="tarjeta-kengo rounded-2xl p-6 hover:scale-105 transition-transform">
              <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <span class="text-2xl">{{ feature.icon }}</span>
              </div>
              <h3 class="text-xl font-bold text-gray-900 mb-2">{{ feature.title }}</h3>
              <p class="text-gray-600">{{ feature.description }}</p>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class FeaturesComponent {
  features = [
    {
      icon: '🎬',
      title: 'Videos profesionales',
      description: 'Mas de 500 ejercicios grabados por fisioterapeutas con instrucciones claras y demostraciones en HD.',
    },
    {
      icon: '📋',
      title: 'Planes personalizados',
      description: 'Ejercicios adaptados a tu lesion y horario, asignados por dias de la semana.',
    },
    {
      icon: '📊',
      title: 'Seguimiento de dolor',
      description: 'Registra como te sientes en cada sesion para que tu fisio ajuste el tratamiento.',
    },
    {
      icon: '🔔',
      title: 'Recordatorios',
      description: 'Nunca olvides tu rutina de ejercicios gracias a las notificaciones diarias.',
    },
    {
      icon: '🏥',
      title: 'Multi-clinica',
      description: 'Un fisioterapeuta puede gestionar varias clinicas y pacientes desde una sola cuenta.',
    },
    {
      icon: '🔐',
      title: 'Codigos de acceso',
      description: 'Invita pacientes de forma segura con codigos unicos de 8 caracteres.',
    },
  ];
}
