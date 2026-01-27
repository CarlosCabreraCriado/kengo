import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-features',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="features" class="features-section">
      <!-- Mesh Gradient Background -->
      <div class="mesh-bg">
        <div class="mesh-blob mesh-1"></div>
        <div class="mesh-blob mesh-2"></div>
        <div class="mesh-blob mesh-3"></div>
      </div>

      <!-- Floating Grid Pattern -->
      <div class="grid-pattern"></div>

      <div class="features-content">
        <!-- Editorial Header -->
        <header class="editorial-header">
          <div class="header-layout">
            <div class="header-left">
              <span class="issue-label">Funcionalidades</span>
              <h2 class="mega-title">
                <span class="title-line">Herramientas</span>
                <span class="title-line accent">que curan</span>
              </h2>
            </div>
            <div class="header-right">
              <p class="header-description">
                Tecnologia disenada por fisioterapeutas para transformar la recuperacion de tus pacientes.
              </p>
              <div class="stat-pill">
                <span class="stat-number">+500</span>
                <span class="stat-text">ejercicios HD</span>
              </div>
            </div>
          </div>
          <div class="header-divider">
            <div class="divider-line"></div>
            <div class="divider-dot"></div>
          </div>
        </header>

        <!-- Bento Grid Layout -->
        <div class="bento-grid">
          <!-- Featured Card - Videos -->
          <article class="bento-card featured" data-feature="videos">
            <div class="card-inner">
              <div class="card-visual">
                <div class="video-preview">
                  <div class="preview-frame">
                    <div class="frame-content">
                      <div class="play-button">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="8,5 19,12 8,19"/>
                        </svg>
                      </div>
                      <div class="video-waves">
                        <span></span><span></span><span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                  <div class="preview-glow"></div>
                </div>
              </div>
              <div class="card-content">
                <div class="card-badge">Catalogo</div>
                <h3 class="card-title">Videos profesionales</h3>
                <p class="card-description">
                  Biblioteca curada con ejercicios grabados por fisioterapeutas. Instrucciones claras, demostraciones en HD.
                </p>
              </div>
              <div class="card-number">01</div>
            </div>
          </article>

          <!-- Planes Card -->
          <article class="bento-card vertical" data-feature="planes">
            <div class="card-inner">
              <div class="card-visual">
                <div class="calendar-visual">
                  <div class="week-row">
                    @for (day of weekDays; track day) {
                      <div class="day-cell" [class.active]="day.active" [class.today]="day.today">
                        <span class="day-letter">{{ day.letter }}</span>
                        <span class="day-dot" *ngIf="day.active"></span>
                      </div>
                    }
                  </div>
                </div>
              </div>
              <div class="card-content">
                <div class="card-badge gold">Personalizacion</div>
                <h3 class="card-title">Planes a medida</h3>
                <p class="card-description">
                  Rutinas adaptadas a cada paciente, organizadas por dias de la semana.
                </p>
              </div>
              <div class="card-number">02</div>
            </div>
          </article>

          <!-- Seguimiento Card -->
          <article class="bento-card" data-feature="seguimiento">
            <div class="card-inner">
              <div class="card-visual">
                <div class="chart-visual">
                  <svg viewBox="0 0 120 60" class="mini-chart">
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#e75c3e" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="#e75c3e" stop-opacity="0"/>
                      </linearGradient>
                    </defs>
                    <path class="chart-area" d="M0,45 Q20,40 30,35 T60,25 T90,15 T120,20 L120,60 L0,60 Z" fill="url(#chartGradient)"/>
                    <path class="chart-line" d="M0,45 Q20,40 30,35 T60,25 T90,15 T120,20" fill="none" stroke="#e75c3e" stroke-width="2.5" stroke-linecap="round"/>
                    <circle class="chart-dot" cx="120" cy="20" r="4" fill="#e75c3e"/>
                  </svg>
                  <div class="trend-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M7 17l5-5 5 5"/>
                      <path d="M7 11l5-5 5 5"/>
                    </svg>
                    Mejorando
                  </div>
                </div>
              </div>
              <div class="card-content">
                <div class="card-badge green">Progreso</div>
                <h3 class="card-title">Seguimiento del dolor</h3>
                <p class="card-description">
                  El paciente registra como se siente. Tu ajustas el tratamiento.
                </p>
              </div>
              <div class="card-number">03</div>
            </div>
          </article>

          <!-- Recordatorios Card -->
          <article class="bento-card" data-feature="recordatorios">
            <div class="card-inner">
              <div class="card-visual">
                <div class="notification-visual">
                  <div class="notif-card">
                    <div class="notif-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      </svg>
                    </div>
                    <div class="notif-content">
                      <span class="notif-title">Hora de ejercicios</span>
                      <span class="notif-time">Ahora</span>
                    </div>
                    <div class="notif-pulse"></div>
                  </div>
                </div>
              </div>
              <div class="card-content">
                <div class="card-badge blue">Automatico</div>
                <h3 class="card-title">Recordatorios</h3>
                <p class="card-description">
                  Notificaciones inteligentes para que nunca olviden su rutina.
                </p>
              </div>
              <div class="card-number">04</div>
            </div>
          </article>

          <!-- Multi-clinica Card -->
          <article class="bento-card wide" data-feature="multiclinica">
            <div class="card-inner">
              <div class="card-visual">
                <div class="clinics-visual">
                  <div class="clinic-node main">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a3 3 0 0 0-3 3v1H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3V5a3 3 0 0 0-3-3zm0 2a1 1 0 0 1 1 1v1h-2V5a1 1 0 0 1 1-1zm-1 7h2v2h2v2h-2v2h-2v-2H9v-2h2v-2z"/>
                    </svg>
                  </div>
                  <div class="clinic-connections">
                    <div class="connection-line line-1"></div>
                    <div class="connection-line line-2"></div>
                  </div>
                  <div class="clinic-node sub node-1">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="8" r="4"/>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    </svg>
                  </div>
                  <div class="clinic-node sub node-2">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="8" r="4"/>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    </svg>
                  </div>
                </div>
              </div>
              <div class="card-content">
                <div class="card-badge purple">Escalable</div>
                <h3 class="card-title">Gestion multi-clinica</h3>
                <p class="card-description">
                  Una cuenta, multiples clinicas. Gestiona todos tus pacientes desde un solo lugar con acceso diferenciado.
                </p>
              </div>
              <div class="card-number">05</div>
            </div>
          </article>

          <!-- Codigos Card -->
          <article class="bento-card" data-feature="codigos">
            <div class="card-inner">
              <div class="card-visual">
                <div class="code-visual">
                  <div class="code-display">
                    <span class="code-char">K</span>
                    <span class="code-char">3</span>
                    <span class="code-char">N</span>
                    <span class="code-char">G</span>
                    <span class="code-char">0</span>
                    <span class="code-char accent">2</span>
                    <span class="code-char accent">4</span>
                    <span class="code-char accent">X</span>
                  </div>
                  <div class="code-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      <path d="M9 12l2 2 4-4"/>
                    </svg>
                    Codigo seguro
                  </div>
                </div>
              </div>
              <div class="card-content">
                <div class="card-badge pink">Seguridad</div>
                <h3 class="card-title">Codigos de acceso</h3>
                <p class="card-description">
                  Invita pacientes de forma segura con codigos unicos de 8 caracteres.
                </p>
              </div>
              <div class="card-number">06</div>
            </div>
          </article>
        </div>

        <!-- Bottom CTA Strip -->
        <div class="cta-strip">
          <div class="cta-content">
            <div class="cta-text">
              <span class="cta-label">Mobile-first</span>
              <h3 class="cta-title">Experiencia nativa en cualquier dispositivo</h3>
            </div>
            <a href="https://app.kengoapp.com/registro" class="cta-button">
              <span>Comenzar gratis</span>
              <div class="button-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </a>
          </div>
          <div class="cta-decoration">
            <div class="deco-ring ring-1"></div>
            <div class="deco-ring ring-2"></div>
            <div class="deco-ring ring-3"></div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ========================================
       FEATURES SECTION - Editorial Bento Style
       Premium Glassmorphism + Magazine Layout
    ======================================== */

    .features-section {
      position: relative;
      padding: 5rem 0 6rem;
      overflow: hidden;
      background: linear-gradient(
        165deg,
        #fffcf9 0%,
        #fff8f3 25%,
        #fffaf6 50%,
        #fff 100%
      );
    }

    @media (min-width: 1024px) {
      .features-section {
        padding: 7rem 0 8rem;
      }
    }

    /* ----------------------------------------
       Mesh Gradient Background
    ---------------------------------------- */
    .mesh-bg {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }

    .mesh-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(100px);
      opacity: 0.6;
      will-change: transform;
    }

    .mesh-1 {
      width: 600px;
      height: 600px;
      top: -15%;
      right: -10%;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.18) 0%, transparent 70%);
      animation: meshFloat1 25s ease-in-out infinite;
    }

    .mesh-2 {
      width: 500px;
      height: 500px;
      bottom: 10%;
      left: -12%;
      background: radial-gradient(circle, rgba(239, 192, 72, 0.15) 0%, transparent 70%);
      animation: meshFloat2 30s ease-in-out infinite;
    }

    .mesh-3 {
      width: 400px;
      height: 400px;
      top: 45%;
      right: 25%;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.1) 0%, transparent 70%);
      animation: meshFloat3 20s ease-in-out infinite;
    }

    @keyframes meshFloat1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(-40px, 60px) scale(1.1); }
      66% { transform: translate(30px, -30px) scale(0.95); }
    }

    @keyframes meshFloat2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(60px, -40px) scale(1.08); }
    }

    @keyframes meshFloat3 {
      0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); }
      50% { transform: translate(-30px, 50px) scale(1.15) rotate(5deg); }
    }

    /* ----------------------------------------
       Grid Pattern Overlay
    ---------------------------------------- */
    .grid-pattern {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(231, 92, 62, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(231, 92, 62, 0.03) 1px, transparent 1px);
      background-size: 60px 60px;
      pointer-events: none;
      mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 70%);
    }

    /* ----------------------------------------
       Content Container
    ---------------------------------------- */
    .features-content {
      position: relative;
      z-index: 1;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.25rem;
    }

    @media (min-width: 640px) {
      .features-content {
        padding: 0 2rem;
      }
    }

    @media (min-width: 1024px) {
      .features-content {
        padding: 0 2.5rem;
      }
    }

    /* ========================================
       EDITORIAL HEADER
    ======================================== */
    .editorial-header {
      margin-bottom: 3.5rem;
    }

    @media (min-width: 1024px) {
      .editorial-header {
        margin-bottom: 4.5rem;
      }
    }

    .header-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
      margin-bottom: 2rem;
    }

    @media (min-width: 768px) {
      .header-layout {
        grid-template-columns: 1.2fr 1fr;
        gap: 3rem;
        align-items: end;
      }
    }

    .header-left {
      animation: slideInLeft 0.8s cubic-bezier(0.22, 1, 0.36, 1) backwards;
    }

    @keyframes slideInLeft {
      from {
        opacity: 0;
        transform: translateX(-30px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .issue-label {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #e75c3e;
      margin-bottom: 1rem;
    }

    .issue-label::before {
      content: '';
      width: 24px;
      height: 2px;
      background: linear-gradient(90deg, #e75c3e, #efc048);
      border-radius: 1px;
    }

    .mega-title {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: clamp(2.5rem, 7vw, 4.5rem);
      font-weight: 400;
      line-height: 0.95;
      color: #1a1a1a;
      letter-spacing: -0.02em;
    }

    .title-line {
      display: block;
    }

    .title-line.accent {
      color: #e75c3e;
      position: relative;
    }

    .title-line.accent::after {
      content: '';
      position: absolute;
      bottom: 0.05em;
      left: 0;
      width: 100%;
      height: 0.08em;
      background: linear-gradient(90deg, rgba(231, 92, 62, 0.3), rgba(239, 192, 72, 0.2));
      border-radius: 4px;
      transform: scaleX(0);
      transform-origin: left;
      animation: lineGrow 1s cubic-bezier(0.22, 1, 0.36, 1) 0.5s forwards;
    }

    @keyframes lineGrow {
      to { transform: scaleX(1); }
    }

    .header-right {
      animation: slideInRight 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.15s backwards;
    }

    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(30px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .header-description {
      font-size: 1.0625rem;
      line-height: 1.7;
      color: #64748b;
      margin-bottom: 1.5rem;
      max-width: 380px;
    }

    .stat-pill {
      display: inline-flex;
      align-items: baseline;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.1) 0%, rgba(239, 192, 72, 0.06) 100%);
      border: 1px solid rgba(231, 92, 62, 0.15);
      border-radius: 100px;
    }

    .stat-number {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: 1.5rem;
      color: #e75c3e;
    }

    .stat-text {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #94a3b8;
      letter-spacing: 0.02em;
    }

    .header-divider {
      display: flex;
      align-items: center;
      gap: 1rem;
      animation: fadeIn 0.6s ease-out 0.3s backwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .divider-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, rgba(231, 92, 62, 0.2), rgba(231, 92, 62, 0.05));
    }

    .divider-dot {
      width: 6px;
      height: 6px;
      background: #e75c3e;
      border-radius: 50%;
      animation: dotPulse 2s ease-in-out infinite;
    }

    @keyframes dotPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.4); opacity: 0.6; }
    }

    /* ========================================
       BENTO GRID
    ======================================== */
    .bento-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    @media (min-width: 640px) {
      .bento-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1.25rem;
      }
    }

    @media (min-width: 1024px) {
      .bento-grid {
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: auto auto auto;
        gap: 1.5rem;
      }
    }

    /* ========================================
       BENTO CARD BASE
    ======================================== */
    .bento-card {
      position: relative;
      border-radius: 24px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.7);
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.02),
        0 4px 16px rgba(0, 0, 0, 0.04);
      transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      animation: cardReveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards;
    }

    .bento-card:nth-child(1) { animation-delay: 0.1s; }
    .bento-card:nth-child(2) { animation-delay: 0.15s; }
    .bento-card:nth-child(3) { animation-delay: 0.2s; }
    .bento-card:nth-child(4) { animation-delay: 0.25s; }
    .bento-card:nth-child(5) { animation-delay: 0.3s; }
    .bento-card:nth-child(6) { animation-delay: 0.35s; }

    @keyframes cardReveal {
      from {
        opacity: 0;
        transform: translateY(30px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .bento-card:hover {
      transform: translateY(-8px);
      background: rgba(255, 255, 255, 0.85);
      border-color: rgba(231, 92, 62, 0.15);
      box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.02),
        0 16px 48px rgba(231, 92, 62, 0.12),
        0 8px 24px rgba(0, 0, 0, 0.06);
    }

    /* Card Variants */
    .bento-card.featured {
      grid-column: 1;
    }

    @media (min-width: 1024px) {
      .bento-card.featured {
        grid-column: 1;
        grid-row: 1 / 3;
      }

      .bento-card.vertical {
        grid-row: span 1;
      }

      .bento-card.wide {
        grid-column: span 2;
      }
    }

    .card-inner {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 1.75rem;
    }

    @media (min-width: 1024px) {
      .card-inner {
        padding: 2rem;
      }

      .bento-card.featured .card-inner {
        padding: 2.5rem;
      }
    }

    /* Card Number */
    .card-number {
      position: absolute;
      top: 1.5rem;
      right: 1.5rem;
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: 0.875rem;
      color: rgba(231, 92, 62, 0.2);
      transition: all 0.4s ease;
    }

    .bento-card:hover .card-number {
      color: rgba(231, 92, 62, 0.4);
      transform: translateX(-4px);
    }

    /* ----------------------------------------
       Card Visual Area
    ---------------------------------------- */
    .card-visual {
      margin-bottom: 1.5rem;
    }

    @media (min-width: 1024px) {
      .bento-card.featured .card-visual {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 2rem;
      }
    }

    /* ----------------------------------------
       Card Content
    ---------------------------------------- */
    .card-content {
      margin-top: auto;
    }

    .card-badge {
      display: inline-block;
      padding: 0.375rem 0.875rem;
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #e75c3e;
      background: rgba(231, 92, 62, 0.08);
      border-radius: 100px;
      margin-bottom: 0.875rem;
    }

    .card-badge.gold {
      color: #b8860b;
      background: rgba(239, 192, 72, 0.12);
    }

    .card-badge.green {
      color: #16a34a;
      background: rgba(34, 197, 94, 0.1);
    }

    .card-badge.blue {
      color: #2563eb;
      background: rgba(59, 130, 246, 0.1);
    }

    .card-badge.purple {
      color: #7c3aed;
      background: rgba(139, 92, 246, 0.1);
    }

    .card-badge.pink {
      color: #db2777;
      background: rgba(236, 72, 153, 0.1);
    }

    .card-title {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: 1.375rem;
      font-weight: 400;
      color: #1a1a1a;
      margin-bottom: 0.625rem;
      line-height: 1.2;
      transition: color 0.3s ease;
    }

    @media (min-width: 1024px) {
      .bento-card.featured .card-title {
        font-size: 1.625rem;
      }
    }

    .bento-card:hover .card-title {
      color: #e75c3e;
    }

    .card-description {
      font-size: 0.9375rem;
      line-height: 1.6;
      color: #64748b;
    }

    /* ========================================
       FEATURE-SPECIFIC VISUALS
    ======================================== */

    /* Video Preview */
    .video-preview {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 0;
    }

    .preview-frame {
      position: relative;
      width: 140px;
      height: 100px;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
      transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    @media (min-width: 1024px) {
      .preview-frame {
        width: 180px;
        height: 130px;
        border-radius: 16px;
      }
    }

    .bento-card:hover .preview-frame {
      transform: scale(1.05) rotate(-2deg);
    }

    .frame-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .play-button {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d30 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(231, 92, 62, 0.4);
      transition: all 0.3s ease;
    }

    .play-button svg {
      width: 16px;
      height: 16px;
      color: white;
      margin-left: 2px;
    }

    .bento-card:hover .play-button {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(231, 92, 62, 0.5);
    }

    .video-waves {
      display: flex;
      align-items: end;
      gap: 3px;
      height: 16px;
    }

    .video-waves span {
      width: 3px;
      background: rgba(231, 92, 62, 0.6);
      border-radius: 2px;
      animation: waveBar 1.2s ease-in-out infinite;
    }

    .video-waves span:nth-child(1) { height: 40%; animation-delay: 0s; }
    .video-waves span:nth-child(2) { height: 70%; animation-delay: 0.1s; }
    .video-waves span:nth-child(3) { height: 100%; animation-delay: 0.2s; }
    .video-waves span:nth-child(4) { height: 60%; animation-delay: 0.3s; }
    .video-waves span:nth-child(5) { height: 30%; animation-delay: 0.4s; }

    @keyframes waveBar {
      0%, 100% { transform: scaleY(1); }
      50% { transform: scaleY(0.5); }
    }

    .preview-glow {
      position: absolute;
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.15) 0%, transparent 70%);
      border-radius: 50%;
      filter: blur(30px);
      z-index: -1;
      animation: glowPulse 3s ease-in-out infinite;
    }

    @keyframes glowPulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.1); }
    }

    /* Calendar Visual */
    .calendar-visual {
      padding: 1rem 0;
    }

    .week-row {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
    }

    .day-cell {
      width: 36px;
      height: 44px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      background: rgba(255, 255, 255, 0.5);
      border: 1px solid rgba(0, 0, 0, 0.04);
      border-radius: 10px;
      transition: all 0.3s ease;
    }

    .day-cell.active {
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.1) 0%, rgba(239, 192, 72, 0.05) 100%);
      border-color: rgba(231, 92, 62, 0.15);
    }

    .day-cell.today {
      background: linear-gradient(135deg, #e75c3e 0%, #d14d30 100%);
      border-color: transparent;
      box-shadow: 0 4px 12px rgba(231, 92, 62, 0.3);
    }

    .day-letter {
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
    }

    .day-cell.today .day-letter {
      color: white;
    }

    .day-cell.active .day-letter {
      color: #e75c3e;
    }

    .day-dot {
      width: 4px;
      height: 4px;
      background: #e75c3e;
      border-radius: 50%;
    }

    .day-cell.today .day-dot {
      background: white;
    }

    .bento-card:hover .day-cell.active {
      transform: translateY(-2px);
    }

    /* Chart Visual */
    .chart-visual {
      position: relative;
      padding: 1rem 0;
    }

    .mini-chart {
      width: 100%;
      height: 60px;
    }

    .chart-line {
      stroke-dasharray: 200;
      stroke-dashoffset: 200;
      animation: drawLine 1.5s ease-out 0.5s forwards;
    }

    @keyframes drawLine {
      to { stroke-dashoffset: 0; }
    }

    .chart-dot {
      opacity: 0;
      animation: dotAppear 0.3s ease-out 1.8s forwards;
    }

    @keyframes dotAppear {
      to { opacity: 1; }
    }

    .trend-badge {
      position: absolute;
      top: 0;
      right: 0;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      background: rgba(34, 197, 94, 0.1);
      border-radius: 100px;
      font-size: 0.6875rem;
      font-weight: 700;
      color: #16a34a;
    }

    .trend-badge svg {
      width: 12px;
      height: 12px;
    }

    /* Notification Visual */
    .notification-visual {
      padding: 1rem 0;
      display: flex;
      justify-content: center;
    }

    .notif-card {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 0.875rem 1.25rem;
      background: white;
      border-radius: 14px;
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.06),
        0 8px 24px rgba(0, 0, 0, 0.08);
      transition: transform 0.3s ease;
    }

    .bento-card:hover .notif-card {
      transform: translateX(4px);
    }

    .notif-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%);
      border-radius: 10px;
    }

    .notif-icon svg {
      width: 18px;
      height: 18px;
      color: #3b82f6;
    }

    .notif-content {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .notif-title {
      font-size: 0.8125rem;
      font-weight: 700;
      color: #1a1a1a;
    }

    .notif-time {
      font-size: 0.6875rem;
      color: #94a3b8;
    }

    .notif-pulse {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 12px;
      height: 12px;
      background: #ef4444;
      border: 2px solid white;
      border-radius: 50%;
      animation: notifPulse 2s ease-in-out infinite;
    }

    @keyframes notifPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }

    /* Clinics Visual */
    .clinics-visual {
      position: relative;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .clinic-node {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .clinic-node.main {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d30 100%);
      box-shadow: 0 4px 20px rgba(231, 92, 62, 0.35);
      z-index: 2;
    }

    .clinic-node.main svg {
      width: 24px;
      height: 24px;
      color: white;
    }

    .clinic-node.sub {
      width: 40px;
      height: 40px;
      background: white;
      border: 2px solid rgba(231, 92, 62, 0.15);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }

    .clinic-node.sub svg {
      width: 18px;
      height: 18px;
      color: #64748b;
    }

    .clinic-node.node-1 {
      left: calc(50% - 70px);
      top: calc(50% - 30px);
    }

    .clinic-node.node-2 {
      right: calc(50% - 70px);
      top: calc(50% + 10px);
    }

    .clinic-connections {
      position: absolute;
      inset: 0;
      z-index: 1;
    }

    .connection-line {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40px;
      height: 2px;
      background: linear-gradient(90deg, rgba(231, 92, 62, 0.3), rgba(231, 92, 62, 0.1));
      border-radius: 1px;
      transform-origin: left center;
    }

    .connection-line.line-1 {
      transform: rotate(-150deg) translateY(-50%);
    }

    .connection-line.line-2 {
      transform: rotate(-30deg) translateY(-50%);
    }

    .bento-card:hover .clinic-node.main {
      transform: scale(1.1);
    }

    .bento-card:hover .clinic-node.sub {
      border-color: rgba(231, 92, 62, 0.3);
    }

    .bento-card:hover .clinic-node.node-1 {
      transform: translate(-4px, -4px);
    }

    .bento-card:hover .clinic-node.node-2 {
      transform: translate(4px, 4px);
    }

    /* Code Visual */
    .code-visual {
      padding: 1rem 0;
    }

    .code-display {
      display: flex;
      justify-content: center;
      gap: 0.375rem;
      margin-bottom: 1rem;
    }

    .code-char {
      width: 28px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 8px;
      font-family: "kengoFont", monospace;
      font-size: 1rem;
      font-weight: 700;
      color: #1a1a1a;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      transition: all 0.3s ease;
    }

    .code-char.accent {
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.08) 0%, rgba(239, 192, 72, 0.04) 100%);
      border-color: rgba(231, 92, 62, 0.12);
      color: #e75c3e;
    }

    .bento-card:hover .code-char {
      transform: translateY(-2px);
    }

    .bento-card:hover .code-char:nth-child(1) { transition-delay: 0s; }
    .bento-card:hover .code-char:nth-child(2) { transition-delay: 0.02s; }
    .bento-card:hover .code-char:nth-child(3) { transition-delay: 0.04s; }
    .bento-card:hover .code-char:nth-child(4) { transition-delay: 0.06s; }
    .bento-card:hover .code-char:nth-child(5) { transition-delay: 0.08s; }
    .bento-card:hover .code-char:nth-child(6) { transition-delay: 0.1s; }
    .bento-card:hover .code-char:nth-child(7) { transition-delay: 0.12s; }
    .bento-card:hover .code-char:nth-child(8) { transition-delay: 0.14s; }

    .code-label {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #16a34a;
    }

    .code-label svg {
      width: 14px;
      height: 14px;
    }

    /* ========================================
       CTA STRIP
    ======================================== */
    .cta-strip {
      position: relative;
      margin-top: 3rem;
      padding: 2.5rem 2rem;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d30 50%, #c44a2d 100%);
      border-radius: 24px;
      overflow: hidden;
      animation: fadeInUp 0.6s ease-out 0.5s backwards;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(24px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (min-width: 1024px) {
      .cta-strip {
        margin-top: 4rem;
        padding: 3rem 3.5rem;
        border-radius: 28px;
      }
    }

    .cta-content {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      text-align: center;
    }

    @media (min-width: 768px) {
      .cta-content {
        flex-direction: row;
        justify-content: space-between;
        text-align: left;
      }
    }

    .cta-label {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 0.5rem;
    }

    .cta-title {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: clamp(1.375rem, 3vw, 1.75rem);
      font-weight: 400;
      color: white;
      line-height: 1.2;
      max-width: 420px;
    }

    .cta-button {
      display: inline-flex;
      align-items: center;
      gap: 0.875rem;
      padding: 1rem 1.75rem;
      background: white;
      color: #1a1a1a;
      font-size: 0.9375rem;
      font-weight: 700;
      text-decoration: none;
      border-radius: 14px;
      flex-shrink: 0;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .cta-button:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .cta-button:active {
      transform: scale(0.98);
    }

    .button-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.1) 0%, rgba(239, 192, 72, 0.05) 100%);
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    .button-arrow svg {
      width: 16px;
      height: 16px;
      color: #e75c3e;
      transition: transform 0.3s ease;
    }

    .cta-button:hover .button-arrow {
      background: linear-gradient(135deg, #e75c3e 0%, #d14d30 100%);
    }

    .cta-button:hover .button-arrow svg {
      color: white;
      transform: translateX(3px);
    }

    /* CTA Decorations */
    .cta-decoration {
      position: absolute;
      top: 50%;
      right: 5%;
      transform: translateY(-50%);
      pointer-events: none;
    }

    .deco-ring {
      position: absolute;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 50%;
    }

    .ring-1 {
      width: 120px;
      height: 120px;
      top: -60px;
      left: -60px;
      animation: ringPulse 4s ease-in-out infinite;
    }

    .ring-2 {
      width: 200px;
      height: 200px;
      top: -100px;
      left: -100px;
      animation: ringPulse 4s ease-in-out 1s infinite;
    }

    .ring-3 {
      width: 280px;
      height: 280px;
      top: -140px;
      left: -140px;
      animation: ringPulse 4s ease-in-out 2s infinite;
    }

    @keyframes ringPulse {
      0%, 100% { opacity: 0.1; transform: scale(1); }
      50% { opacity: 0.2; transform: scale(1.05); }
    }

    /* ========================================
       REDUCED MOTION
    ======================================== */
    @media (prefers-reduced-motion: reduce) {
      .mesh-blob,
      .bento-card,
      .chart-line,
      .chart-dot,
      .video-waves span,
      .preview-glow,
      .notif-pulse,
      .divider-dot,
      .deco-ring {
        animation: none;
      }

      .bento-card,
      .cta-strip {
        animation: none;
        opacity: 1;
        transform: none;
      }

      .title-line.accent::after {
        animation: none;
        transform: scaleX(1);
      }
    }
  `]
})
export class FeaturesComponent {
  weekDays = [
    { letter: 'L', active: true, today: false },
    { letter: 'M', active: true, today: false },
    { letter: 'X', active: false, today: false },
    { letter: 'J', active: true, today: true },
    { letter: 'V', active: true, today: false },
    { letter: 'S', active: false, today: false },
    { letter: 'D', active: false, today: false },
  ];
}
