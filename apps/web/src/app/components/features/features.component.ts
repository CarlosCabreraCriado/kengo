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
            Todo lo que necesitas para tu clinica
          </h2>
          <p class="text-xl text-gray-600 max-w-2xl mx-auto">
            Herramientas disenadas para fisioterapeutas que quieren optimizar su trabajo.
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
      icon: '📚',
      title: 'Catalogo de ejercicios',
      description: 'Accede a una amplia biblioteca de ejercicios con instrucciones detalladas y videos demostrativos.',
    },
    {
      icon: '📋',
      title: 'Planes personalizados',
      description: 'Crea planes de tratamiento adaptados a las necesidades de cada paciente.',
    },
    {
      icon: '👥',
      title: 'Gestion de pacientes',
      description: 'Mantiene un registro organizado de todos tus pacientes y su historial.',
    },
    {
      icon: '🏥',
      title: 'Gestion de clinica',
      description: 'Administra tu clinica, fisioterapeutas y codigos de acceso facilmente.',
    },
    {
      icon: '📱',
      title: 'App para pacientes',
      description: 'Tus pacientes pueden ver sus ejercicios desde cualquier dispositivo.',
    },
    {
      icon: '📊',
      title: 'Seguimiento',
      description: 'Monitorea el progreso de tus pacientes y ajusta los planes segun sea necesario.',
    },
  ];
}
