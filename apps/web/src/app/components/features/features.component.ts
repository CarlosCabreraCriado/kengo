import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-features',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="features" class="features-section">
      <!-- Animated Wave Background -->
      <div class="wave-container">
        <svg class="wave wave-1" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="rgba(231, 92, 62, 0.08)" d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
        <svg class="wave wave-2" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="rgba(239, 192, 72, 0.06)" d="M0,64L48,96C96,128,192,192,288,202.7C384,213,480,171,576,144C672,117,768,107,864,128C960,149,1056,203,1152,208C1248,213,1344,171,1392,149.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
        <svg class="wave wave-3" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="rgba(231, 92, 62, 0.05)" d="M0,256L48,234.7C96,213,192,171,288,165.3C384,160,480,192,576,208C672,224,768,224,864,197.3C960,171,1056,117,1152,112C1248,107,1344,149,1392,170.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      <!-- Aurora Orbs -->
      <div class="aurora-orb aurora-orb-1"></div>
      <div class="aurora-orb aurora-orb-2"></div>
      <div class="aurora-orb aurora-orb-3"></div>

      <div class="features-content">
        <!-- Section Header -->
        <header class="section-header">
          <div class="badge-container">
            <span class="section-badge">
              <span class="badge-dot"></span>
              Funcionalidades
            </span>
          </div>
          <h2 class="section-title">
            Todo lo que necesitas para
            <span class="title-highlight">mejorar</span>
          </h2>
          <p class="section-description">
            Herramientas disenadas para mejorar la adherencia y el seguimiento de tratamientos de fisioterapia.
          </p>
        </header>

        <!-- Features Grid -->
        <div class="features-grid">
          @for (feature of features; track feature.id; let i = $index) {
            <article
              class="feature-card"
              [style.--delay]="(i * 0.08) + 's'"
            >
              <!-- Glow Effect -->
              <div class="card-glow" [style.--glow-color]="feature.glowColor"></div>

              <!-- Icon Container -->
              <div class="icon-container" [style.--icon-gradient]="feature.iconGradient">
                <div class="icon-inner">
                  @switch (feature.id) {
                    @case ('videos') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="3"/>
                        <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/>
                      </svg>
                    }
                    @case ('planes') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="4" y="3" width="16" height="18" rx="2"/>
                        <path d="M8 7h8"/>
                        <path d="M8 11h8"/>
                        <path d="M8 15h5"/>
                        <path d="M15 15l2 2 3-3" stroke="#22c55e" stroke-width="2"/>
                      </svg>
                    }
                    @case ('seguimiento') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 3v18h18"/>
                        <path d="M7 16l4-4 4 4 5-6"/>
                        <circle cx="20" cy="6" r="2.5" fill="#22c55e" stroke="none"/>
                      </svg>
                    }
                    @case ('recordatorios') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        <circle cx="18" cy="5" r="3" fill="#ef4444" stroke="none"/>
                      </svg>
                    }
                    @case ('multiclinica') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="8" width="7" height="13" rx="1"/>
                        <rect x="14" y="8" width="7" height="13" rx="1"/>
                        <path d="M6.5 5a2.5 2.5 0 0 1 5 0v3h-5V5z"/>
                        <path d="M12.5 5a2.5 2.5 0 0 1 5 0v3h-5V5z"/>
                        <path d="M12 12v4" stroke-dasharray="2 2"/>
                      </svg>
                    }
                    @case ('codigos') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="10" rx="2"/>
                        <circle cx="12" cy="16" r="2"/>
                        <path d="M12 14v-2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    }
                  }
                </div>
              </div>

              <!-- Content -->
              <div class="card-content">
                <h3 class="feature-title">{{ feature.title }}</h3>
                <p class="feature-description">{{ feature.description }}</p>
              </div>

              <!-- Stats Badge -->
              @if (feature.stat) {
                <div class="stat-badge">
                  <span class="stat-value">{{ feature.stat.value }}</span>
                  <span class="stat-label">{{ feature.stat.label }}</span>
                </div>
              }

              <!-- Decorative Corner -->
              <div class="corner-decoration"></div>
            </article>
          }
        </div>

        <!-- Highlight Banner -->
        <div class="highlight-banner">
          <!-- Animated Background -->
          <div class="banner-bg">
            <div class="bg-wave bg-wave-1"></div>
            <div class="bg-wave bg-wave-2"></div>
            <div class="bg-orb bg-orb-1"></div>
            <div class="bg-orb bg-orb-2"></div>
          </div>

          <div class="banner-content">
            <!-- Icon -->
            <div class="banner-icon">
              <div class="icon-pulse"></div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>

            <!-- Text -->
            <div class="banner-text">
              <h3 class="banner-title">Experiencia movil nativa</h3>
              <p class="banner-description">
                Disenado mobile-first para que tus pacientes tengan la mejor experiencia desde cualquier dispositivo. Instalable como app, funciona sin conexion.
              </p>
            </div>

            <!-- CTA -->
            <a href="https://app.kengoapp.com/registro" class="banner-cta">
              <span>Probar gratis</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"/>
                <path d="M12 5l7 7-7 7"/>
              </svg>
            </a>
          </div>

          <!-- Floating Elements -->
          <div class="floating-element floating-1">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div class="floating-element floating-2">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </div>
          <div class="floating-element floating-3">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12,2 22,22 2,22"/>
            </svg>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ========================================
       FEATURES SECTION - Kengo Style
       Glassmorphism + Warm Waves
    ======================================== */

    .features-section {
      position: relative;
      padding: 6rem 0 7rem;
      overflow: hidden;
      background: linear-gradient(
        180deg,
        #fff9f5 0%,
        #fffbf7 40%,
        #fff 100%
      );
    }

    @media (min-width: 1024px) {
      .features-section {
        padding: 8rem 0 10rem;
      }
    }

    /* ----------------------------------------
       Animated Wave Background
    ---------------------------------------- */
    .wave-container {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60%;
      pointer-events: none;
      z-index: 0;
    }

    .wave {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: auto;
      min-height: 200px;
    }

    .wave-1 {
      animation: waveFloat1 20s ease-in-out infinite;
    }

    .wave-2 {
      animation: waveFloat2 25s ease-in-out infinite;
      animation-delay: -5s;
    }

    .wave-3 {
      animation: waveFloat3 18s ease-in-out infinite;
      animation-delay: -10s;
    }

    @keyframes waveFloat1 {
      0%, 100% { transform: translateX(0) translateY(0); }
      50% { transform: translateX(-2%) translateY(-8px); }
    }

    @keyframes waveFloat2 {
      0%, 100% { transform: translateX(0) translateY(0); }
      50% { transform: translateX(3%) translateY(-12px); }
    }

    @keyframes waveFloat3 {
      0%, 100% { transform: translateX(0) translateY(0); }
      50% { transform: translateX(-1.5%) translateY(-6px); }
    }

    /* ----------------------------------------
       Aurora Orbs
    ---------------------------------------- */
    .aurora-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.5;
      pointer-events: none;
      z-index: 0;
    }

    .aurora-orb-1 {
      width: 400px;
      height: 400px;
      top: 10%;
      right: -10%;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.25) 0%, transparent 70%);
      animation: auroraFloat1 20s ease-in-out infinite;
    }

    .aurora-orb-2 {
      width: 350px;
      height: 350px;
      bottom: 20%;
      left: -8%;
      background: radial-gradient(circle, rgba(239, 192, 72, 0.2) 0%, transparent 70%);
      animation: auroraFloat2 25s ease-in-out infinite;
    }

    .aurora-orb-3 {
      width: 250px;
      height: 250px;
      top: 50%;
      left: 40%;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.15) 0%, transparent 70%);
      animation: auroraFloat3 18s ease-in-out infinite;
    }

    @keyframes auroraFloat1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(-30px, 40px) scale(1.1); }
      66% { transform: translate(20px, -20px) scale(0.95); }
    }

    @keyframes auroraFloat2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(40px, -30px) scale(1.05); }
      66% { transform: translate(-20px, 50px) scale(1.1); }
    }

    @keyframes auroraFloat3 {
      0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
      50% { transform: translate(-40px, 30px) scale(1.2); opacity: 0.7; }
    }

    /* ----------------------------------------
       Content Container
    ---------------------------------------- */
    .features-content {
      position: relative;
      z-index: 1;
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    @media (min-width: 640px) {
      .features-content {
        padding: 0 2rem;
      }
    }

    @media (min-width: 1024px) {
      .features-content {
        padding: 0 3rem;
      }
    }

    /* ----------------------------------------
       Section Header
    ---------------------------------------- */
    .section-header {
      text-align: center;
      max-width: 680px;
      margin: 0 auto 4rem;
    }

    @media (min-width: 1024px) {
      .section-header {
        margin-bottom: 5rem;
      }
    }

    .badge-container {
      margin-bottom: 1.5rem;
      animation: fadeInUp 0.6s ease-out backwards;
    }

    .section-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1.25rem;
      background: rgba(231, 92, 62, 0.1);
      border: 1px solid rgba(231, 92, 62, 0.15);
      border-radius: 100px;
      font-size: 0.875rem;
      font-weight: 600;
      color: #e75c3e;
      letter-spacing: 0.02em;
    }

    .badge-dot {
      width: 6px;
      height: 6px;
      background: #e75c3e;
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }

    .section-title {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 700;
      color: #1f2937;
      line-height: 1.15;
      margin-bottom: 1.25rem;
      animation: fadeInUp 0.6s ease-out 0.1s backwards;
    }

    .title-highlight {
      color: #e75c3e;
      position: relative;
    }

    .title-highlight::after {
      content: '';
      position: absolute;
      bottom: 0.1em;
      left: 0;
      right: 0;
      height: 0.12em;
      background: linear-gradient(90deg, rgba(231, 92, 62, 0.4), rgba(239, 192, 72, 0.3));
      border-radius: 4px;
      transform: scaleX(0);
      transform-origin: left;
      animation: underlineGrow 0.8s ease-out 0.6s forwards;
    }

    @keyframes underlineGrow {
      to { transform: scaleX(1); }
    }

    .section-description {
      font-size: 1.125rem;
      color: #6b7280;
      line-height: 1.7;
      animation: fadeInUp 0.6s ease-out 0.2s backwards;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ----------------------------------------
       Features Grid
    ---------------------------------------- */
    .features-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    @media (min-width: 640px) {
      .features-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1.5rem;
      }
    }

    @media (min-width: 1024px) {
      .features-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 1.75rem;
      }
    }

    /* ----------------------------------------
       Feature Card
    ---------------------------------------- */
    .feature-card {
      position: relative;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 24px;
      overflow: hidden;
      cursor: default;
      animation: cardFadeIn 0.5s ease-out var(--delay, 0s) backwards;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    @keyframes cardFadeIn {
      from {
        opacity: 0;
        transform: translateY(24px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .feature-card:hover {
      transform: translateY(-6px);
      background: rgba(255, 255, 255, 0.85);
      border-color: rgba(231, 92, 62, 0.2);
      box-shadow:
        0 20px 40px rgba(231, 92, 62, 0.1),
        0 8px 16px rgba(0, 0, 0, 0.06);
    }

    /* Card Glow Effect */
    .card-glow {
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(
        circle at center,
        var(--glow-color, rgba(231, 92, 62, 0.08)) 0%,
        transparent 50%
      );
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
    }

    .feature-card:hover .card-glow {
      opacity: 1;
    }

    /* Corner Decoration */
    .corner-decoration {
      position: absolute;
      top: 0;
      right: 0;
      width: 80px;
      height: 80px;
      background: linear-gradient(
        135deg,
        transparent 50%,
        rgba(231, 92, 62, 0.03) 50%
      );
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .feature-card:hover .corner-decoration {
      opacity: 1;
    }

    /* ----------------------------------------
       Icon Container
    ---------------------------------------- */
    .icon-container {
      position: relative;
      width: 64px;
      height: 64px;
      margin-bottom: 1.5rem;
      z-index: 1;
    }

    .icon-inner {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--icon-gradient, linear-gradient(135deg, rgba(231, 92, 62, 0.12) 0%, rgba(255, 200, 180, 0.08) 100%));
      border-radius: 18px;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .feature-card:hover .icon-inner {
      transform: scale(1.08) rotate(-3deg);
      box-shadow: 0 8px 24px rgba(231, 92, 62, 0.15);
    }

    .icon-inner svg {
      width: 28px;
      height: 28px;
      color: #e75c3e;
      transition: transform 0.3s ease;
    }

    .feature-card:hover .icon-inner svg {
      transform: scale(1.1);
    }

    /* ----------------------------------------
       Card Content
    ---------------------------------------- */
    .card-content {
      position: relative;
      z-index: 1;
    }

    .feature-title {
      font-family: "Galvji", system-ui, sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 0.625rem;
      transition: color 0.3s ease;
    }

    .feature-card:hover .feature-title {
      color: #e75c3e;
    }

    .feature-description {
      font-size: 0.9375rem;
      color: #6b7280;
      line-height: 1.65;
    }

    /* ----------------------------------------
       Stat Badge
    ---------------------------------------- */
    .stat-badge {
      display: inline-flex;
      align-items: baseline;
      gap: 0.375rem;
      margin-top: 1.25rem;
      padding: 0.5rem 1rem;
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.1) 0%, rgba(239, 192, 72, 0.08) 100%);
      border: 1px solid rgba(231, 92, 62, 0.12);
      border-radius: 100px;
      position: relative;
      z-index: 1;
    }

    .stat-value {
      font-size: 1.125rem;
      font-weight: 800;
      color: #e75c3e;
    }

    .stat-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #e75c3e;
      opacity: 0.75;
      text-transform: lowercase;
    }

    /* ----------------------------------------
       Highlight Banner
    ---------------------------------------- */
    .highlight-banner {
      position: relative;
      margin-top: 4rem;
      padding: 3rem 2rem;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d30 40%, #c94a2f 100%);
      border-radius: 28px;
      overflow: hidden;
      animation: fadeInUp 0.6s ease-out 0.5s backwards;
    }

    @media (min-width: 1024px) {
      .highlight-banner {
        margin-top: 5rem;
        padding: 3.5rem 4rem;
        border-radius: 32px;
      }
    }

    /* Banner Background Effects */
    .banner-bg {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }

    .bg-wave {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 100%;
      background: linear-gradient(
        180deg,
        transparent 0%,
        rgba(255, 255, 255, 0.03) 100%
      );
    }

    .bg-wave-1 {
      transform: skewY(-3deg);
      transform-origin: bottom left;
    }

    .bg-wave-2 {
      transform: skewY(2deg);
      transform-origin: bottom right;
      background: linear-gradient(
        180deg,
        transparent 30%,
        rgba(255, 255, 255, 0.02) 100%
      );
    }

    .bg-orb {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
    }

    .bg-orb-1 {
      width: 300px;
      height: 300px;
      top: -120px;
      right: -60px;
      animation: orbFloat1 15s ease-in-out infinite;
    }

    .bg-orb-2 {
      width: 200px;
      height: 200px;
      bottom: -80px;
      left: 15%;
      animation: orbFloat2 18s ease-in-out infinite;
    }

    @keyframes orbFloat1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-20px, 30px) scale(1.1); }
    }

    @keyframes orbFloat2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(30px, -20px) scale(1.05); }
    }

    /* Banner Content */
    .banner-content {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1.5rem;
    }

    @media (min-width: 1024px) {
      .banner-content {
        flex-direction: row;
        text-align: left;
        gap: 2.5rem;
      }
    }

    /* Banner Icon */
    .banner-icon {
      position: relative;
      flex-shrink: 0;
    }

    .banner-icon svg {
      position: relative;
      z-index: 1;
      width: 40px;
      height: 40px;
      color: white;
    }

    .icon-pulse {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 72px;
      height: 72px;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      animation: iconPulse 3s ease-in-out infinite;
    }

    @keyframes iconPulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
      50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.25; }
    }

    /* Banner Text */
    .banner-text {
      flex: 1;
    }

    .banner-title {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: 1.625rem;
      font-weight: 700;
      color: white;
      margin-bottom: 0.625rem;
    }

    @media (min-width: 1024px) {
      .banner-title {
        font-size: 1.875rem;
      }
    }

    .banner-description {
      font-size: 1rem;
      color: rgba(255, 255, 255, 0.85);
      line-height: 1.65;
      max-width: 560px;
    }

    /* Banner CTA */
    .banner-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1.75rem;
      background: white;
      color: #1f2937;
      font-size: 0.9375rem;
      font-weight: 700;
      border-radius: 14px;
      text-decoration: none;
      flex-shrink: 0;
      transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .banner-cta:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }

    .banner-cta:active {
      transform: scale(0.98);
    }

    .banner-cta svg {
      width: 18px;
      height: 18px;
      transition: transform 0.3s ease;
    }

    .banner-cta:hover svg {
      transform: translateX(4px);
    }

    /* Floating Elements */
    .floating-element {
      position: absolute;
      z-index: 1;
      opacity: 0.1;
      pointer-events: none;
    }

    .floating-element svg {
      width: 100%;
      height: 100%;
      fill: white;
    }

    .floating-1 {
      width: 32px;
      height: 32px;
      top: 20%;
      right: 12%;
      animation: float1 12s ease-in-out infinite;
    }

    .floating-2 {
      width: 20px;
      height: 20px;
      bottom: 25%;
      right: 25%;
      animation: float2 15s ease-in-out infinite;
    }

    .floating-3 {
      width: 24px;
      height: 24px;
      top: 60%;
      left: 8%;
      animation: float3 10s ease-in-out infinite;
    }

    @keyframes float1 {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      50% { transform: translate(-10px, 15px) rotate(180deg); }
    }

    @keyframes float2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(15px, -10px) scale(1.2); }
    }

    @keyframes float3 {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      50% { transform: translate(8px, -12px) rotate(-90deg); }
    }

    /* ----------------------------------------
       Reduced Motion
    ---------------------------------------- */
    @media (prefers-reduced-motion: reduce) {
      .wave,
      .aurora-orb,
      .bg-orb,
      .floating-element,
      .badge-dot,
      .icon-pulse {
        animation: none;
      }

      .feature-card,
      .title-highlight::after {
        animation: none;
        opacity: 1;
        transform: none;
      }

      .section-badge,
      .section-title,
      .section-description,
      .highlight-banner {
        animation: none;
      }
    }
  `]
})
export class FeaturesComponent {
  features = [
    {
      id: 'videos',
      title: 'Videos profesionales',
      description: 'Mas de 500 ejercicios grabados por fisioterapeutas con instrucciones claras y demostraciones en HD.',
      iconGradient: 'linear-gradient(135deg, rgba(231, 92, 62, 0.15) 0%, rgba(255, 180, 160, 0.08) 100%)',
      glowColor: 'rgba(231, 92, 62, 0.12)',
      stat: { value: '+500', label: 'ejercicios' },
    },
    {
      id: 'planes',
      title: 'Planes personalizados',
      description: 'Ejercicios adaptados a tu lesion y horario, asignados por dias de la semana segun tus necesidades.',
      iconGradient: 'linear-gradient(135deg, rgba(239, 192, 72, 0.18) 0%, rgba(255, 220, 150, 0.08) 100%)',
      glowColor: 'rgba(239, 192, 72, 0.12)',
      stat: null,
    },
    {
      id: 'seguimiento',
      title: 'Seguimiento de dolor',
      description: 'Registra como te sientes en cada sesion para que tu fisio ajuste el tratamiento de forma precisa.',
      iconGradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(134, 239, 172, 0.08) 100%)',
      glowColor: 'rgba(34, 197, 94, 0.1)',
      stat: null,
    },
    {
      id: 'recordatorios',
      title: 'Recordatorios',
      description: 'Nunca olvides tu rutina de ejercicios gracias a las notificaciones diarias personalizadas.',
      iconGradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 197, 253, 0.08) 100%)',
      glowColor: 'rgba(59, 130, 246, 0.1)',
      stat: null,
    },
    {
      id: 'multiclinica',
      title: 'Multi-clinica',
      description: 'Un fisioterapeuta puede gestionar varias clinicas y pacientes desde una sola cuenta profesional.',
      iconGradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(196, 181, 253, 0.08) 100%)',
      glowColor: 'rgba(139, 92, 246, 0.1)',
      stat: null,
    },
    {
      id: 'codigos',
      title: 'Codigos de acceso',
      description: 'Invita pacientes de forma segura con codigos unicos de 8 caracteres, sin compartir datos sensibles.',
      iconGradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(249, 168, 212, 0.08) 100%)',
      glowColor: 'rgba(236, 72, 153, 0.1)',
      stat: null,
    },
  ];
}
