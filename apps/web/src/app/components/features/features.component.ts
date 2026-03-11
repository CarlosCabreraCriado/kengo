import { Component, signal, OnDestroy } from '@angular/core';

@Component({
  selector: 'web-features',
  standalone: true,
  imports: [],
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
        <!-- Editorial Header — Asimétrico -->
        <header class="editorial-header">
          <div class="header-columns">
            <!-- Izquierda: eyebrow + título -->
            <div class="header-left">
              <div class="header-eyebrow">
                <span class="eyebrow-dot"></span>
                <span class="eyebrow-label">Plataforma clínica</span>
              </div>
              <h2 class="mega-title">
                <span class="title-line">La herramienta</span>
                <span class="title-line accent">que conecta</span>
                <span class="title-line">tu clínica y tus pacientes</span>
              </h2>
            </div>

            <!-- Derecha: descripción + tags -->
            <div class="header-right">
              <p class="header-description">
                Kengo reúne en un solo lugar todo lo que necesitas para el
                seguimiento de tus pacientes: videoteca profesional de
                ejercicios, planes personalizados, control del dolor y gestión
                multi-clínica. Diseñado específicamente para fisioterapeutas.
              </p>
              <div class="feature-tags">
                <span class="ftag">Videoteca HD</span>
                <span class="ftag">Planes</span>
                <span class="ftag">Seguimiento</span>
                <span class="ftag">Multi-clínica</span>
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
          <!-- 1. Featured Card - Videos -->
          <article class="bento-card featured" data-feature="videos">
            <div class="card-inner">
              <div class="card-visual">
                <div class="exercise-slideshow">
                  @for (img of exerciseImages; track img; let i = $index) {
                    <img
                      [src]="img"
                      [alt]="'Ejercicio ' + (i + 1)"
                      class="slide-img"
                      [class.active]="i === currentSlide()"
                    />
                  }
                  <div class="slide-overlay"></div>
                  <div class="slide-dots">
                    @for (img of exerciseImages; track img; let i = $index) {
                      <span
                        class="dot"
                        [class.active]="i === currentSlide()"
                      ></span>
                    }
                  </div>
                </div>
              </div>
              <div class="card-content">
                <div class="card-badge">Catálogo</div>
                <h3 class="card-title">Videos profesionales</h3>
                <p class="card-description">
                  Biblioteca curada con ejercicios grabados por fisioterapeutas.
                </p>
              </div>
              <div class="card-number">01</div>
            </div>
          </article>

          <!-- 2. Planes Card -->
          <article class="bento-card vertical" data-feature="planes">
            <div class="card-inner">
              <div class="card-visual">
                <div class="calendar-visual">
                  <div class="calendar-month-label">Marzo 2026</div>
                  <div class="week-row dimmed">
                    @for (day of weekDaysPrev; track day.letter) {
                      <div class="day-cell" [class.active]="day.active">
                        <span class="day-letter">{{ day.letter }}</span>
                        @if (day.active) {
                          <span class="day-dot"></span>
                        }
                      </div>
                    }
                  </div>
                  <div class="week-row">
                    @for (day of weekDays; track day.letter) {
                      <div
                        class="day-cell"
                        [class.active]="day.active"
                        [class.today]="day.today"
                      >
                        <span class="day-letter">{{ day.letter }}</span>
                        @if (day.active) {
                          <span class="day-dot"></span>
                        }
                      </div>
                    }
                  </div>
                  <div class="week-row dimmed">
                    @for (day of weekDaysNext; track day.letter) {
                      <div class="day-cell" [class.active]="day.active">
                        <span class="day-letter">{{ day.letter }}</span>
                        @if (day.active) {
                          <span class="day-dot"></span>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>
              <div class="card-content">
                <div class="card-badge gold">Personalización</div>
                <h3 class="card-title">Planes a medida</h3>
                <p class="card-description">
                  Rutinas adaptadas a cada paciente, organizadas por días de la
                  semana.
                </p>
              </div>
            </div>
          </article>

                    <!-- 3. Recordatorios Card -->
          <article class="bento-card" data-feature="recordatorios">
            <div class="card-inner">
              <div class="card-visual">
                <div class="notification-visual">
                  <div class="notif-card">
                    <div class="notif-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
                <div class="card-badge blue">Automático</div>
                <h3 class="card-title">Recordatorios</h3>
                <p class="card-description">
                  Notificaciones inteligentes para que nunca olviden su rutina.
                </p>
              </div>
            </div>
          </article>

          <!-- 4. Seguimiento Card -->
          <article class="bento-card" data-feature="seguimiento">
            <div class="card-inner">
              <div class="card-visual">
                <div class="pain-journey-visual">
                  <div class="pj-start">
                    <span class="pj-num coral">8</span>
                    <span class="pj-week">Semana 1</span>
                  </div>
                  <svg class="pj-svg" viewBox="0 0 240 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="painLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#e75c3e"/>
                        <stop offset="50%" stop-color="#efc048"/>
                        <stop offset="100%" stop-color="#16a34a"/>
                      </linearGradient>
                      <filter id="movingDotGlow" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
                        <feMerge>
                          <feMergeNode in="blur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    <path id="painCurve" class="pj-curve"
                      d="M 25,10 C 80,10 160,70 215,70"
                      stroke="url(#painLineGrad)" stroke-width="2.5"
                      stroke-linecap="round" fill="none" pathLength="1"/>
                    <circle class="pj-dot d1" cx="25"  cy="10" r="4"   fill="#e75c3e"/>
                    <circle class="pj-dot d5" cx="215" cy="70" r="4.5" fill="#16a34a"/>
                    <circle r="5" fill="white" stroke="#e75c3e" stroke-width="2" filter="url(#movingDotGlow)" opacity="0">
                      <animate attributeName="opacity" values="0;1" dur="0.01s" begin="2.3s" fill="freeze"/>
                      <animate attributeName="stroke" values="#e75c3e;#efc048;#16a34a" dur="6s" repeatCount="indefinite" begin="2.3s" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"/>
                      <animateMotion dur="6s" repeatCount="indefinite" begin="2.3s"
                        calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.58 1">
                        <mpath href="#painCurve"/>
                      </animateMotion>
                    </circle>
                  </svg>
                  <div class="pj-end">
                    <span class="pj-num green">2</span>
                    <span class="pj-week">Semana 5</span>
                  </div>
                </div>
              </div>
              <div class="card-content">
                <div class="card-badge green">Progreso</div>
                <h3 class="card-title">Seguimiento del dolor</h3>
                <p class="card-description">
                  El paciente registra cómo se siente. Tú ajustas el
                  tratamiento.
                </p>
              </div>
            </div>
          </article>



          <!-- 5. Códigos Card -->
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
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    Código seguro
                  </div>
                </div>
              </div>
              <div class="card-content">
                <div class="card-badge pink">Seguridad</div>
                <h3 class="card-title">Códigos de acceso</h3>
                <p class="card-description">
                  Invita pacientes de forma segura con códigos únicos de 8
                  caracteres.
                </p>
              </div>
            </div>
          </article>

          <!-- 6. Multi-clínica Card (full width row 3) -->
          <article class="bento-card wide" data-feature="multiclinica">
            <div class="card-inner">
              <div class="card-visual">
                <div class="clinics-visual">
                  <div class="clinic-node main">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path
                        d="M12 2a3 3 0 0 0-3 3v1H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3V5a3 3 0 0 0-3-3zm0 2a1 1 0 0 1 1 1v1h-2V5a1 1 0 0 1 1-1zm-1 7h2v2h2v2h-2v2h-2v-2H9v-2h2v-2z"
                      />
                    </svg>
                  </div>
                  <div class="clinic-connections">
                    <div class="connection-line line-1"></div>
                    <div class="connection-line line-2"></div>
                    <div class="connection-line line-3"></div>
                    <div class="connection-line line-4"></div>
                  </div>
                  <div class="clinic-node sub node-1">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    </svg>
                  </div>
                  <div class="clinic-node sub node-2">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    </svg>
                  </div>
                  <div class="clinic-node sub node-3">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    </svg>
                  </div>
                  <div class="clinic-node sub node-4">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    </svg>
                  </div>
                </div>
              </div>
              <div class="card-content">
                <div class="card-badge purple">Escalable</div>
                <h3 class="card-title">Gestión multi-clínica</h3>
                <p class="card-description">
                  Gestiona todos tus pacientes
                  desde un solo lugar con acceso diferenciado.
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
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
        background: radial-gradient(
          circle,
          rgba(231, 92, 62, 0.18) 0%,
          transparent 70%
        );
        animation: meshFloat1 25s ease-in-out infinite;
      }

      .mesh-2 {
        width: 500px;
        height: 500px;
        bottom: 10%;
        left: -12%;
        background: radial-gradient(
          circle,
          rgba(239, 192, 72, 0.15) 0%,
          transparent 70%
        );
        animation: meshFloat2 30s ease-in-out infinite;
      }

      .mesh-3 {
        width: 400px;
        height: 400px;
        top: 45%;
        right: 25%;
        background: radial-gradient(
          circle,
          rgba(231, 92, 62, 0.1) 0%,
          transparent 70%
        );
        animation: meshFloat3 20s ease-in-out infinite;
      }

      @keyframes meshFloat1 {
        0%,
        100% {
          transform: translate(0, 0) scale(1);
        }
        33% {
          transform: translate(-40px, 60px) scale(1.1);
        }
        66% {
          transform: translate(30px, -30px) scale(0.95);
        }
      }

      @keyframes meshFloat2 {
        0%,
        100% {
          transform: translate(0, 0) scale(1);
        }
        50% {
          transform: translate(60px, -40px) scale(1.08);
        }
      }

      @keyframes meshFloat3 {
        0%,
        100% {
          transform: translate(0, 0) scale(1) rotate(0deg);
        }
        50% {
          transform: translate(-30px, 50px) scale(1.15) rotate(5deg);
        }
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
        mask-image: radial-gradient(
          ellipse 80% 60% at 50% 30%,
          black 20%,
          transparent 70%
        );
        -webkit-mask-image: radial-gradient(
          ellipse 80% 60% at 50% 30%,
          black 20%,
          transparent 70%
        );
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
       EDITORIAL HEADER — ASIMÉTRICO
    ======================================== */
      .editorial-header {
        position: relative;
        margin-bottom: 3.5rem;
        overflow: hidden;
      }

      @media (min-width: 1024px) {
        .editorial-header {
          margin-bottom: 4.5rem;
        }
      }

      /* Número decorativo de fondo */
      .header-bg-text {
        position: absolute;
        top: -0.2em;
        right: -0.05em;
        font-family: 'kengoFont', system-ui, sans-serif;
        font-size: clamp(8rem, 20vw, 16rem);
        font-weight: 400;
        line-height: 1;
        color: transparent;
        -webkit-text-stroke: 1.5px rgba(231, 92, 62, 0.07);
        pointer-events: none;
        user-select: none;
        letter-spacing: -0.04em;
      }

      /* Columnas dos-tercios / un-tercio */
      .header-columns {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        padding-bottom: 2rem;
      }

      @media (min-width: 1024px) {
        .header-columns {
          flex-direction: row;
          align-items: center;
          gap: 5rem;
        }
      }

      .header-left {
        flex: 1;
      }

      .header-right {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding-bottom: 0.25rem;
      }

      /* Eyebrow */
      .header-eyebrow {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        margin-bottom: 1.25rem;
        animation: fadeIn 0.6s ease-out backwards;
      }

      .eyebrow-dot {
        width: 7px;
        height: 7px;
        background: #e75c3e;
        border-radius: 50%;
        flex-shrink: 0;
        animation: dotPulse 2.5s ease-in-out infinite;
      }

      .eyebrow-label {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: #e75c3e;
      }

      /* Título principal */
      .mega-title {
        font-family: 'kengoFont', system-ui, sans-serif;
        font-size: clamp(2.6rem, 7.5vw, 5rem);
        font-weight: 400;
        line-height: 0.93;
        color: #1a1a1a;
        letter-spacing: -0.025em;
        animation: fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.1s backwards;
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
        height: 0.07em;
        background: linear-gradient(
          90deg,
          rgba(231, 92, 62, 0.35),
          rgba(239, 192, 72, 0.15)
        );
        border-radius: 4px;
        transform: scaleX(0);
        transform-origin: left;
        animation: lineGrow 1s cubic-bezier(0.22, 1, 0.36, 1) 0.55s forwards;
      }

      @keyframes lineGrow {
        to {
          transform: scaleX(1);
        }
      }

      /* Descripción */
      .header-description {
        font-size: 1rem;
        line-height: 1.75;
        color: #64748b;
        animation: fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards;
      }

      /* Feature tags */
      .feature-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        animation: fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s backwards;
      }

      .ftag {
        display: inline-flex;
        align-items: center;
        padding: 0.375rem 0.875rem;
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #1a1a1a;
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(0, 0, 0, 0.07);
        border-radius: 100px;
        backdrop-filter: blur(8px);
        transition: all 0.3s ease;
      }

      .ftag:hover {
        background: rgba(231, 92, 62, 0.06);
        border-color: rgba(231, 92, 62, 0.2);
        color: #e75c3e;
      }

      /* Divisor inferior */
      .header-divider {
        display: flex;
        align-items: center;
        gap: 1rem;
        animation: fadeIn 0.6s ease-out 0.45s backwards;
      }

      .divider-line {
        flex: 1;
        height: 1px;
        background: linear-gradient(
          90deg,
          rgba(231, 92, 62, 0.22),
          rgba(231, 92, 62, 0.04)
        );
      }

      .divider-dot {
        width: 6px;
        height: 6px;
        background: #e75c3e;
        border-radius: 50%;
        animation: dotPulse 2s ease-in-out infinite;
      }

      @keyframes dotPulse {
        0%,
        100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.5);
          opacity: 0.55;
        }
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
          grid-template-rows: auto auto;
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

      .bento-card.featured {
        box-shadow:
          0 1px 2px rgba(0, 0, 0, 0.02),
          0 4px 16px rgba(0, 0, 0, 0.04),
          inset 0 0 0 1px rgba(231, 92, 62, 0.08);
      }

      .bento-card:nth-child(1) {
        animation-delay: 0.1s;
      }
      .bento-card:nth-child(2) {
        animation-delay: 0.15s;
      }
      .bento-card:nth-child(3) {
        animation-delay: 0.2s;
      }
      .bento-card:nth-child(4) {
        animation-delay: 0.25s;
      }
      .bento-card:nth-child(5) {
        animation-delay: 0.3s;
      }
      .bento-card:nth-child(6) {
        animation-delay: 0.35s;
      }

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

      .bento-card.featured:hover {
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.02),
          0 20px 60px rgba(231, 92, 62, 0.18),
          0 8px 24px rgba(0, 0, 0, 0.06),
          inset 0 0 0 1px rgba(231, 92, 62, 0.2);
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
      }

      /* Card Number */
      .card-number {
        position: absolute;
        top: 1.5rem;
        right: 1.5rem;
        font-family: 'kengoFont', system-ui, sans-serif;
        font-size: 0.875rem;
        color: rgba(231, 92, 62, 0.2);
        transition: all 0.4s ease;
      }

      .bento-card:hover .card-number {
        color: rgba(231, 92, 62, 0.4);
        transform: translateX(-4px);
      }

      /* ----------------------------------------
       Card Visual Area — altura fija uniforme
    ---------------------------------------- */
      .card-visual {
        height: 160px;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
      }

      @media (min-width: 640px) {
        .card-visual {
          height: 175px;
        }
      }

      @media (min-width: 1024px) {
        .card-visual {
          height: 185px;
        }
      }

      /* Segunda fila (cards 4-6): tarjetas más compactas */
      @media (min-width: 1024px) {
        .bento-card:nth-child(4) .card-visual,
        .bento-card:nth-child(5) .card-visual,
        .bento-card:nth-child(6) .card-visual {
          height: 110px;
          margin-bottom: 1rem;
        }

        .bento-card:nth-child(4) .card-inner,
        .bento-card:nth-child(5) .card-inner,
        .bento-card:nth-child(6) .card-inner {
          padding: 1.5rem;
        }

        .bento-card:nth-child(4) .card-title,
        .bento-card:nth-child(5) .card-title,
        .bento-card:nth-child(6) .card-title {
          font-size: 1.2rem;
          margin-bottom: 0.375rem;
        }

        .bento-card:nth-child(4) .card-description,
        .bento-card:nth-child(5) .card-description,
        .bento-card:nth-child(6) .card-description {
          font-size: 0.875rem;
          line-height: 1.5;
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
        font-family: 'kengoFont', system-ui, sans-serif;
        font-size: 1.375rem;
        font-weight: 400;
        color: #1a1a1a;
        margin-bottom: 0.625rem;
        line-height: 1.2;
        transition: color 0.3s ease;
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

      /* Exercise Slideshow */
      .exercise-slideshow {
        position: relative;
        display: grid;
        border-radius: 16px;
        overflow: hidden;
        width: 100%;
        height: 100%;
      }

      .slide-img {
        grid-area: 1 / 1;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center top;
        display: block;
        opacity: 0;
        transition: opacity 0.8s ease-in-out;
      }

      .slide-img.active {
        opacity: 1;
      }

      .slide-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to bottom,
          transparent 55%,
          rgba(0, 0, 0, 0.35) 100%
        );
        z-index: 1;
        pointer-events: none;
      }

      .slide-dots {
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 6px;
        z-index: 2;
      }

      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        transition: all 0.3s ease;
      }

      .dot.active {
        background: #e75c3e;
        width: 18px;
        border-radius: 3px;
      }

      /* Calendar Visual */
      .calendar-visual {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0.5rem 0;
      }

      .calendar-month-label {
        text-align: center;
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #94a3b8;
        margin-bottom: 0.625rem;
      }

      .week-row {
        display: flex;
        justify-content: center;
        gap: 0.375rem;
        margin-bottom: 0.375rem;
      }

      .week-row.dimmed .day-cell {
        opacity: 0.45;
      }

      .week-row.dimmed .day-cell.active {
        opacity: 0.6;
      }

      .day-cell {
        width: 32px;
        height: 38px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        background: rgba(255, 255, 255, 0.5);
        border: 1px solid rgba(0, 0, 0, 0.04);
        border-radius: 8px;
        transition: all 0.3s ease;
      }

      .day-cell.active {
        background: linear-gradient(
          135deg,
          rgba(231, 92, 62, 0.1) 0%,
          rgba(239, 192, 72, 0.05) 100%
        );
        border-color: rgba(231, 92, 62, 0.15);
      }

      .day-cell.today {
        background: linear-gradient(135deg, #e75c3e 0%, #d14d30 100%);
        border-color: transparent;
        box-shadow: 0 4px 12px rgba(231, 92, 62, 0.3);
      }

      .day-letter {
        font-size: 0.6875rem;
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

      /* Pain Journey Visual */
      .pain-journey-visual {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .pj-start {
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        z-index: 2;
        line-height: 1;
      }

      .pj-end {
        position: absolute;
        bottom: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        z-index: 2;
        line-height: 1;
      }

      .pj-num {
        font-size: 2.25rem;
        font-weight: 800;
        letter-spacing: -0.04em;
        line-height: 1;
      }

      .pj-num.coral { color: #e75c3e; }
      .pj-num.green { color: #16a34a; }

      .pj-week {
        font-size: 0.6rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: rgba(0, 0, 0, 0.3);
        margin-top: 0.2rem;
      }

      .pj-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .pj-curve {
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        animation: drawCurve 2s ease-out 0.3s forwards;
      }

      @keyframes drawCurve {
        to { stroke-dashoffset: 0; }
      }

      .pj-dot {
        opacity: 0;
      }

      .d1 { animation: dotAppear 0.25s ease-out 0.35s forwards; }
      .d5 { animation: dotAppear 0.25s ease-out 2.15s forwards; }

      @keyframes dotAppear {
        to { opacity: 1; }
      }

      /* Desktop compact override para la card seguimiento */
      @media (min-width: 1024px) {
        .bento-card[data-feature="seguimiento"] .card-visual {
          height: 145px;
        }
      }

      /* Notification Visual */
      .notification-visual {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
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
        background: linear-gradient(
          135deg,
          rgba(59, 130, 246, 0.1) 0%,
          rgba(99, 102, 241, 0.05) 100%
        );
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
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.2);
        }
      }

      /* Clinics Visual */
      .clinics-visual {
        position: relative;
        width: 100%;
        height: 100%;
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
        left: calc(50% - 90px);
        top: calc(50% - 35px);
      }

      .clinic-node.node-2 {
        right: calc(50% - 90px);
        top: calc(50% - 35px);
      }

      .clinic-node.node-3 {
        left: calc(50% - 90px);
        top: calc(50% + 5px);
      }

      .clinic-node.node-4 {
        right: calc(50% - 90px);
        top: calc(50% + 5px);
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
        width: 44px;
        height: 2px;
        background: linear-gradient(
          90deg,
          rgba(231, 92, 62, 0.5),
          rgba(231, 92, 62, 0.1)
        );
        border-radius: 1px;
        transform-origin: left center;
        animation: linePulse 2s ease-in-out infinite;
      }

      .connection-line.line-1 {
        transform: rotate(-145deg) translateY(-50%);
        animation-delay: 0s;
      }

      .connection-line.line-2 {
        transform: rotate(-35deg) translateY(-50%);
        animation-delay: 0.5s;
      }

      .connection-line.line-3 {
        transform: rotate(-215deg) translateY(-50%);
        animation-delay: 1s;
      }

      .connection-line.line-4 {
        transform: rotate(-325deg) translateY(-50%);
        animation-delay: 1.5s;
      }

      @keyframes linePulse {
        0%,
        100% {
          opacity: 0.3;
        }
        50% {
          opacity: 0.9;
        }
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
        transform: translate(4px, -4px);
      }

      .bento-card:hover .clinic-node.node-3 {
        transform: translate(-4px, 4px);
      }

      .bento-card:hover .clinic-node.node-4 {
        transform: translate(4px, 4px);
      }

      /* Code Visual */
      .code-visual {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0.5rem 0;
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
        font-family: 'kengoFont', monospace;
        font-size: 1rem;
        font-weight: 700;
        color: #1a1a1a;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        transition: all 0.3s ease;
      }

      .code-char.accent {
        background: linear-gradient(
          135deg,
          rgba(231, 92, 62, 0.08) 0%,
          rgba(239, 192, 72, 0.04) 100%
        );
        border-color: rgba(231, 92, 62, 0.12);
        color: #e75c3e;
      }

      .bento-card:hover .code-char {
        transform: translateY(-2px);
      }

      .bento-card:hover .code-char:nth-child(1) {
        transition-delay: 0s;
      }
      .bento-card:hover .code-char:nth-child(2) {
        transition-delay: 0.02s;
      }
      .bento-card:hover .code-char:nth-child(3) {
        transition-delay: 0.04s;
      }
      .bento-card:hover .code-char:nth-child(4) {
        transition-delay: 0.06s;
      }
      .bento-card:hover .code-char:nth-child(5) {
        transition-delay: 0.08s;
      }
      .bento-card:hover .code-char:nth-child(6) {
        transition-delay: 0.1s;
      }
      .bento-card:hover .code-char:nth-child(7) {
        transition-delay: 0.12s;
      }
      .bento-card:hover .code-char:nth-child(8) {
        transition-delay: 0.14s;
      }

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
       ANIMATIONS
    ======================================== */
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes fadeUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* ========================================
       REDUCED MOTION
    ======================================== */
      @media (prefers-reduced-motion: reduce) {
        .mesh-blob,
        .bento-card,
        .pj-steps,
        .pj-dot,
        .slide-img,
        .notif-pulse,
        .divider-dot,
        .connection-line {
          animation: none;
        }

        .pj-dot {
          opacity: 1;
        }

        .bento-card {
          animation: none;
          opacity: 1;
          transform: none;
        }

        .header-eyebrow,
        .mega-title,
        .header-description,
        .feature-tags,
        .header-divider {
          animation: none;
          opacity: 1;
          transform: none;
        }

        .eyebrow-dot {
          animation: none;
        }

        .title-line.accent::after {
          animation: none;
          transform: scaleX(1);
        }
      }
    `,
  ],
})
export class FeaturesComponent implements OnDestroy {
  exerciseImages = [
    '/ejercicio_1.webp',
    '/ejercicio_2.webp',
    '/ejercicio_3.webp',
    '/ejercicio_4.webp',
  ];
  currentSlide = signal(0);
  private slideInterval = setInterval(() => {
    this.currentSlide.update((i) => (i + 1) % this.exerciseImages.length);
  }, 2500);

  ngOnDestroy() {
    clearInterval(this.slideInterval);
  }

  weekDaysPrev = [
    { letter: 'L', active: true, today: false },
    { letter: 'M', active: false, today: false },
    { letter: 'X', active: true, today: false },
    { letter: 'J', active: false, today: false },
    { letter: 'V', active: true, today: false },
    { letter: 'S', active: false, today: false },
    { letter: 'D', active: false, today: false },
  ];

  weekDays = [
    { letter: 'L', active: true, today: false },
    { letter: 'M', active: true, today: false },
    { letter: 'X', active: false, today: false },
    { letter: 'J', active: true, today: true },
    { letter: 'V', active: true, today: false },
    { letter: 'S', active: false, today: false },
    { letter: 'D', active: false, today: false },
  ];

  weekDaysNext = [
    { letter: 'L', active: false, today: false },
    { letter: 'M', active: true, today: false },
    { letter: 'X', active: true, today: false },
    { letter: 'J', active: false, today: false },
    { letter: 'V', active: true, today: false },
    { letter: 'S', active: false, today: false },
    { letter: 'D', active: false, today: false },
  ];
}
