import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-how-it-works',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="como-funciona" class="py-20 kengo-gradient">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Como funciona
          </h2>
          <p class="text-xl text-gray-700 max-w-2xl mx-auto">
            En 4 sencillos pasos estaras siguiendo tu tratamiento de forma guiada.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          @for (step of steps; track step.number; let i = $index) {
            <div class="relative">
              <div class="tarjeta-kengo rounded-2xl p-6 text-center h-full">
                <div class="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {{ step.number }}
                </div>
                <div class="text-4xl mb-4">{{ step.icon }}</div>
                <h3 class="text-lg font-bold text-gray-900 mb-2">{{ step.title }}</h3>
                <p class="text-gray-600 text-sm">{{ step.description }}</p>
              </div>
              @if (i < steps.length - 1) {
                <div class="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-primary text-2xl">
                  →
                </div>
              }
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class HowItWorksComponent {
  steps = [
    {
      number: 1,
      icon: '📋',
      title: 'El fisio crea tu plan',
      description: 'Selecciona ejercicios personalizados para tu lesion y tu ritmo de vida.',
    },
    {
      number: 2,
      icon: '📱',
      title: 'Recibes tu actividad diaria',
      description: 'Ve que ejercicios tocan hoy con video incluido desde tu movil.',
    },
    {
      number: 3,
      icon: '🎬',
      title: 'Realizas la sesion guiada',
      description: 'Sigue el video, las series y los descansos paso a paso.',
    },
    {
      number: 4,
      icon: '💬',
      title: 'Das feedback',
      description: 'Tu fisio sabe como evolucionas entre consultas gracias a tu registro.',
    },
  ];
}
