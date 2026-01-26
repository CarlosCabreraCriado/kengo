import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="bg-gray-900 text-white py-12">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div class="col-span-1 md:col-span-2">
            <span class="titulo-kengo text-4xl text-primary">KENGO</span>
            <p class="mt-4 text-gray-400 max-w-md">
              La plataforma que ayuda a fisioterapeutas a gestionar ejercicios, pacientes y planes de tratamiento de manera eficiente.
            </p>
          </div>
          <div>
            <h4 class="font-bold mb-4">Enlaces</h4>
            <ul class="space-y-2 text-gray-400">
              <li><a href="#features" class="hover:text-white transition-colors">Funcionalidades</a></li>
              <li><a href="#about" class="hover:text-white transition-colors">Nosotros</a></li>
              <li><a href="#contact" class="hover:text-white transition-colors">Contacto</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-bold mb-4">Legal</h4>
            <ul class="space-y-2 text-gray-400">
              <li><a href="/privacy" class="hover:text-white transition-colors">Privacidad</a></li>
              <li><a href="/terms" class="hover:text-white transition-colors">Terminos</a></li>
            </ul>
          </div>
        </div>
        <div class="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; {{ currentYear }} Kengo. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
}
