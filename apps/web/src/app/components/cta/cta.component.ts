import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-cta',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="py-20 kengo-gradient">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          Empieza a mejorar la adherencia de tus pacientes hoy
        </h2>
        <p class="text-xl text-gray-700 mb-8">
          Registrate gratis y transforma la forma en que tus pacientes siguen sus tratamientos.
        </p>
        <a href="https://app.kengoapp.com/registro" class="inline-block bg-primary text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-primary/90 transition-colors shadow-lg">
          Crear cuenta gratuita
        </a>
      </div>
    </section>
  `,
})
export class CtaComponent {}
