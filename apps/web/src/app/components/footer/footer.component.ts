import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="footer-section relative overflow-hidden">
      <!-- Top Wave Decoration -->
      <div class="footer-wave">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V0H1380C1320 0 1200 0 1080 0C960 0 840 0 720 0C600 0 480 0 360 0C240 0 120 0 60 0H0V120Z" fill="currentColor"/>
        </svg>
      </div>

      <div class="footer-content">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
            <!-- Brand Column -->
            <div class="lg:col-span-5">
              <a href="/" class="inline-block mb-6">
                <span class="titulo-kengo text-4xl text-primary">KENGO</span>
              </a>
              <p class="text-gray-400 text-base leading-relaxed max-w-md mb-8">
                Tu fisio, siempre contigo. Planes de ejercicios personalizados con videos guiados, seguimiento de progreso y conexion directa con tu fisioterapeuta.
              </p>

              <!-- Social Links -->
              <div class="flex items-center gap-4">
                @for (social of socialLinks; track social.id) {
                  <a
                    [href]="social.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="social-link"
                    [attr.aria-label]="social.name"
                  >
                    @switch (social.id) {
                      @case ('twitter') {
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/>
                        </svg>
                      }
                      @case ('instagram') {
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path fill-rule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clip-rule="evenodd"/>
                        </svg>
                      }
                      @case ('linkedin') {
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                        </svg>
                      }
                    }
                  </a>
                }
              </div>
            </div>

            <!-- Links Columns -->
            <div class="lg:col-span-7">
              <div class="grid grid-cols-2 md:grid-cols-3 gap-8">
                <!-- Product -->
                <div>
                  <h4 class="footer-heading">Producto</h4>
                  <ul class="footer-links">
                    <li><a href="#beneficios">Beneficios</a></li>
                    <li><a href="#como-funciona">Como funciona</a></li>
                    <li><a href="#features">Funcionalidades</a></li>
                    <li><a href="https://app.kengoapp.com/registro">Registrarse</a></li>
                  </ul>
                </div>

                <!-- Company -->
                <div>
                  <h4 class="footer-heading">Empresa</h4>
                  <ul class="footer-links">
                    <li><a href="/about">Sobre nosotros</a></li>
                    <li><a href="/contact">Contacto</a></li>
                    <li><a href="/blog">Blog</a></li>
                    <li><a href="/careers">Trabaja con nosotros</a></li>
                  </ul>
                </div>

                <!-- Legal -->
                <div>
                  <h4 class="footer-heading">Legal</h4>
                  <ul class="footer-links">
                    <li><a href="/privacy">Privacidad</a></li>
                    <li><a href="/terms">Terminos</a></li>
                    <li><a href="/cookies">Cookies</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Bar -->
          <div class="footer-bottom">
            <div class="flex flex-col md:flex-row items-center justify-between gap-4">
              <p class="text-gray-500 text-sm">
                &copy; {{ currentYear }} Kengo. Todos los derechos reservados.
              </p>

              <!-- Made with love -->
              <p class="text-gray-500 text-sm flex items-center gap-1">
                Hecho con
                <span class="text-primary">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
                  </svg>
                </span>
                en Espana
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer-section {
      position: relative;
      background: linear-gradient(180deg, #111827 0%, #0f172a 100%);
    }

    .footer-wave {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 120px;
      color: #ffffff;
      transform: translateY(-99%);
    }

    .footer-wave svg {
      width: 100%;
      height: 100%;
    }

    .footer-content {
      position: relative;
      z-index: 1;
    }

    .footer-heading {
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 20px;
    }

    .footer-links {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .footer-links li {
      margin-bottom: 12px;
    }

    .footer-links a {
      color: #9ca3af;
      font-size: 15px;
      text-decoration: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
    }

    .footer-links a:hover {
      color: #e75c3e;
      transform: translateX(4px);
    }

    .social-link {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: #9ca3af;
      transition: all 0.3s ease;
    }

    .social-link:hover {
      background: rgba(231, 92, 62, 0.15);
      border-color: rgba(231, 92, 62, 0.3);
      color: #e75c3e;
      transform: translateY(-2px);
    }

    .social-link svg {
      width: 20px;
      height: 20px;
    }

    .footer-bottom {
      margin-top: 48px;
      padding-top: 32px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
  `]
})
export class FooterComponent {
  currentYear = new Date().getFullYear();

  socialLinks = [
    { id: 'twitter', name: 'Twitter', url: 'https://twitter.com/kengoapp' },
    { id: 'instagram', name: 'Instagram', url: 'https://instagram.com/kengoapp' },
    { id: 'linkedin', name: 'LinkedIn', url: 'https://linkedin.com/company/kengoapp' },
  ];
}
