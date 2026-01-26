import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <a href="/" class="flex items-center gap-2">
            <span class="titulo-kengo text-3xl text-primary">KENGO</span>
          </a>
          <nav class="hidden md:flex items-center gap-8">
            <a href="#features" class="text-gray-600 hover:text-primary transition-colors">Funcionalidades</a>
            <a href="#about" class="text-gray-600 hover:text-primary transition-colors">Nosotros</a>
            <a href="#contact" class="text-gray-600 hover:text-primary transition-colors">Contacto</a>
          </nav>
          <div class="flex items-center gap-4">
            <a href="https://app.kengoapp.com/login" class="hidden sm:block text-gray-600 hover:text-primary transition-colors">
              Iniciar sesion
            </a>
            <a href="https://app.kengoapp.com/registro" class="bg-primary text-white px-4 py-2 rounded-full font-medium hover:bg-primary/90 transition-colors">
              Registrarse
            </a>
          </div>
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {}
