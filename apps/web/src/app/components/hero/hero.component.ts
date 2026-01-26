import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-hero',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="relative min-h-screen flex items-center kengo-gradient pt-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div class="text-center">
          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Gestiona tu clinica de
            <span class="text-primary">fisioterapia</span>
            de forma sencilla
          </h1>
          <p class="text-xl text-gray-700 max-w-2xl mx-auto mb-8">
            Catalogo de ejercicios, planes de tratamiento personalizados y seguimiento de pacientes. Todo en una sola plataforma.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://app.kengoapp.com/registro" class="bg-primary text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-primary/90 transition-colors shadow-lg">
              Empieza gratis
            </a>
            <a href="#features" class="bg-white text-gray-900 px-8 py-4 rounded-full text-lg font-medium hover:bg-gray-100 transition-colors shadow-lg">
              Ver funcionalidades
            </a>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class HeroComponent {}
