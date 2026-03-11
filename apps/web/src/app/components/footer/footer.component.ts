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
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V0H1380C1320 0 1200 0 1080 0C960 0 840 0 720 0C600 0 480 0 360 0C240 0 120 0 60 0H0V120Z"
            fill="currentColor"
          />
        </svg>
      </div>

      <div class="footer-content">
        <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div
            class="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8"
          >
            <!-- Brand Column -->
            <div class="lg:col-span-5">
              <a href="/" class="mb-6 inline-block">
                <span class="titulo-kengo text-primary text-4xl">KENGO</span>
              </a>
              <p class="mb-8 max-w-md text-base leading-relaxed text-gray-400">
                Tu fisio, siempre contigo. Planes de ejercicios personalizados
                con vídeos guiados, seguimiento de progreso y conexión directa
                con tu fisioterapeuta.
              </p>

            </div>

            <!-- Links Columns -->
            <div class="lg:col-span-7">
              <div class="grid grid-cols-2 gap-8">
                <!-- Product -->
                <div>
                  <h4 class="footer-heading">Producto</h4>
                  <ul class="footer-links">
                    <li><a href="#beneficios">Beneficios</a></li>
                    <li><a href="#como-funciona">Cómo funciona</a></li>
                    <li><a href="#features">Funcionalidades</a></li>
                    <li>
                      <a href="https://kengoapp.com/registro">Registrarse</a>
                    </li>
                    <li>
                      <a href="https://kengoapp.com/registro?role=fisio"
                        >Para fisioterapeutas</a
                      >
                    </li>
                  </ul>
                </div>

                <!-- Contact -->
                <div>
                  <h4 class="footer-heading">Contacto</h4>
                  <ul class="footer-links">
                    <li>
                      <a
                        href="mailto:contacto@kengoapp.com"
                        class="contact-email"
                      >
                        <svg
                          class="mr-2 h-4 w-4 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="1.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                          />
                        </svg>
                        info&#64;kengoapp.com
                      </a>
                    </li>
                    <li>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Bar -->
          <div class="footer-bottom">
            <div
              class="flex flex-col items-center justify-between gap-4 md:flex-row"
            >
              <p class="text-sm text-gray-500">
                &copy; {{ currentYear }} Kengo. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
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
    `,
  ],
})
export class FooterComponent {
  currentYear = new Date().getFullYear();

  socialLinks = [
    { id: 'twitter', name: 'Twitter', url: 'https://twitter.com/kengoapp' },
    {
      id: 'instagram',
      name: 'Instagram',
      url: 'https://instagram.com/kengoapp',
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      url: 'https://linkedin.com/company/kengoapp',
    },
  ];
}
