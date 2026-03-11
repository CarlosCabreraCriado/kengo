import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="footer-section">
      <!-- Wave transition from CTA -->
      <div class="footer-wave">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V0H1380C1320 0 1200 0 1080 0C960 0 840 0 720 0C600 0 480 0 360 0C240 0 120 0 60 0H0V120Z" fill="currentColor"/>
        </svg>
      </div>

      <!-- Decorative background elements -->
      <div class="footer-bg-orb footer-orb-1"></div>
      <div class="footer-bg-orb footer-orb-2"></div>
      <div class="footer-dots"></div>

      <!-- Gradient top accent bar -->
      <div class="footer-accent-bar"></div>

      <div class="footer-inner">
        <div class="footer-grid">

          <!-- Brand column -->
          <div class="brand-col">
            <a href="/" class="brand-logo">
              <span class="titulo-kengo">KENGO</span>
            </a>
            <p class="brand-tagline">
              Tu fisio, siempre contigo. Planes de ejercicios personalizados con vídeos guiados y seguimiento de progreso.
            </p>

            <!-- Mini CTA -->
            <a href="https://kengoapp.com/registro" class="footer-cta-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
              </svg>
              Empezar gratis
            </a>
          </div>

          <!-- Links columns -->
          <div class="links-col">
            <h4 class="footer-heading">
              <span class="heading-accent"></span>
              Producto
            </h4>
            <ul class="footer-links">
              <li><a href="#beneficios"><span class="link-arrow">›</span>Beneficios</a></li>
              <li><a href="#como-funciona"><span class="link-arrow">›</span>Cómo funciona</a></li>
              <li><a href="#features"><span class="link-arrow">›</span>Funcionalidades</a></li>
              <li><a href="https://kengoapp.com/registro"><span class="link-arrow">›</span>Registrarse</a></li>
              <li><a href="https://kengoapp.com/registro?role=fisio"><span class="link-arrow">›</span>Para fisioterapeutas</a></li>
            </ul>
          </div>

          <div class="links-col">
            <h4 class="footer-heading">
              <span class="heading-accent"></span>
              Contacto
            </h4>
            <ul class="footer-links">
              <li>
                <a href="mailto:info@kengoapp.com" class="contact-link">
                  <span class="contact-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>
                    </svg>
                  </span>
                  info&#64;kengoapp.com
                </a>
              </li>
            </ul>
          </div>

        </div>

        <!-- Bottom bar -->
        <div class="footer-bottom">
          <p class="copyright">&copy; {{ currentYear }} Kengo. Todos los derechos reservados.</p>
          <p class="made-with">Plataforma especializada para fisioterapia</p>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer-section {
      position: relative;
      background: linear-gradient(160deg, #0f172a 0%, #111827 50%, #0c1524 100%);
      overflow: hidden;
    }

    /* Wave */
    .footer-wave {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 120px;
      color: #ffe4d0;
      transform: translateY(-99%);
      pointer-events: none;
    }
    .footer-wave svg { width: 100%; height: 100%; }

    /* Gradient accent bar */
    .footer-accent-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, #e75c3e 30%, #efc048 70%, transparent 100%);
      opacity: 0.6;
    }

    /* Background orbs */
    .footer-bg-orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      filter: blur(100px);
    }
    .footer-orb-1 {
      width: 500px;
      height: 500px;
      top: -200px;
      right: -100px;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.12) 0%, transparent 70%);
    }
    .footer-orb-2 {
      width: 400px;
      height: 400px;
      bottom: -150px;
      left: -80px;
      background: radial-gradient(circle, rgba(239, 192, 72, 0.08) 0%, transparent 70%);
    }

    /* Dots pattern */
    .footer-dots {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 28px 28px;
      pointer-events: none;
    }

    /* Layout */
    .footer-inner {
      position: relative;
      z-index: 1;
      max-width: 1200px;
      margin: 0 auto;
      padding: 5rem 1.5rem 2.5rem;
    }

    .footer-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 3rem;
      margin-bottom: 4rem;
    }

    @media (min-width: 768px) {
      .footer-grid {
        grid-template-columns: 1.8fr 1fr 1fr;
        gap: 3rem 4rem;
        align-items: start;
      }
    }

    /* Brand column */
    .brand-col {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .brand-logo {
      display: inline-block;
      margin-bottom: 1.25rem;
      text-decoration: none;
    }

    .brand-logo span {
      font-size: 2.5rem;
      color: #e75c3e;
      line-height: 1;
    }

    .brand-tagline {
      color: #6b7280;
      font-size: 0.9375rem;
      line-height: 1.75;
      margin: 0 0 2rem 0;
      max-width: 340px;
    }

    /* Mini CTA button */
    .footer-cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.15) 0%, rgba(231, 92, 62, 0.08) 100%);
      border: 1px solid rgba(231, 92, 62, 0.3);
      border-radius: 100px;
      color: #e75c3e;
      font-size: 0.9375rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.3s ease;
      width: fit-content;
    }
    .footer-cta-btn svg {
      width: 16px;
      height: 16px;
      transition: transform 0.3s ease;
    }
    .footer-cta-btn:hover {
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.25) 0%, rgba(231, 92, 62, 0.15) 100%);
      border-color: rgba(231, 92, 62, 0.5);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(231, 92, 62, 0.15);
    }
    .footer-cta-btn:hover svg {
      transform: translateX(4px);
    }

    /* Links columns */
    .links-col {}

    .footer-heading {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      font-size: 0.8125rem;
      font-weight: 700;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 1.5rem;
    }

    .heading-accent {
      display: block;
      width: 18px;
      height: 2px;
      background: linear-gradient(90deg, #e75c3e, #efc048);
      border-radius: 2px;
      flex-shrink: 0;
    }

    .footer-links {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .footer-links a {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #6b7280;
      font-size: 0.9375rem;
      text-decoration: none;
      transition: all 0.2s ease;
    }

    .link-arrow {
      color: #e75c3e;
      opacity: 0;
      font-size: 1.1rem;
      line-height: 1;
      transform: translateX(-4px);
      transition: all 0.2s ease;
    }

    .footer-links a:hover {
      color: #f3f4f6;
    }
    .footer-links a:hover .link-arrow {
      opacity: 1;
      transform: translateX(0);
    }

    /* Contact link */
    .contact-link {
      display: inline-flex !important;
      align-items: center !important;
      gap: 0.75rem !important;
    }

    .contact-icon {
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      flex-shrink: 0;
      transition: all 0.3s ease;
    }
    .contact-icon svg {
      width: 15px;
      height: 15px;
      color: #9ca3af;
      transition: color 0.3s ease;
    }
    .contact-link:hover .contact-icon {
      background: rgba(231, 92, 62, 0.1);
      border-color: rgba(231, 92, 62, 0.25);
    }
    .contact-link:hover .contact-icon svg {
      color: #e75c3e;
    }

    /* Bottom bar */
    .footer-bottom {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      align-items: center;
      text-align: center;
      padding-top: 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    @media (min-width: 768px) {
      .footer-bottom {
        flex-direction: row;
        justify-content: space-between;
        text-align: left;
      }
    }

    .copyright {
      font-size: 0.875rem;
      color: #4b5563;
      margin: 0;
    }

    .made-with {
      font-size: 0.875rem;
      color: #374151;
      margin: 0;
    }

    .heart {
      color: #e75c3e;
      display: inline-block;
      animation: heartbeat 2s ease-in-out infinite;
    }

    @keyframes heartbeat {
      0%, 100% { transform: scale(1); }
      15% { transform: scale(1.3); }
      30% { transform: scale(1); }
      45% { transform: scale(1.15); }
    }

    @media (prefers-reduced-motion: reduce) {
      .footer-cta-btn,
      .heart { animation: none; }
    }
  `],
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
}
