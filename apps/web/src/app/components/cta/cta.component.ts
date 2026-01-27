import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-cta',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="cta-section">
      <!-- Layered Background -->
      <div class="cta-bg">
        <!-- Warm Gradient Base -->
        <div class="gradient-base"></div>

        <!-- Animated Wave Layers -->
        <svg class="wave-layer wave-1" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,192L60,197.3C120,203,240,213,360,192C480,171,600,117,720,122.7C840,128,960,192,1080,213.3C1200,235,1320,213,1380,202.7L1440,192L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z" />
        </svg>
        <svg class="wave-layer wave-2" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,64L48,96C96,128,192,192,288,197.3C384,203,480,149,576,149.3C672,149,768,203,864,213.3C960,224,1056,192,1152,165.3C1248,139,1344,117,1392,106.7L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
        <svg class="wave-layer wave-3" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,288L48,272C96,256,192,224,288,218.7C384,213,480,235,576,250.7C672,267,768,277,864,261.3C960,245,1056,203,1152,181.3C1248,160,1344,160,1392,160L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>

        <!-- Aurora Orbs -->
        <div class="aurora-orb aurora-orb-1"></div>
        <div class="aurora-orb aurora-orb-2"></div>
        <div class="aurora-orb aurora-orb-3"></div>
        <div class="aurora-orb aurora-orb-4"></div>

        <!-- Grain Texture -->
        <div class="grain-overlay"></div>
      </div>

      <!-- Main Content -->
      <div class="cta-content">
        <!-- Floating Decorative Elements -->
        <div class="floating-shapes">
          <div class="shape shape-1"></div>
          <div class="shape shape-2"></div>
          <div class="shape shape-3"></div>
        </div>

        <!-- Badge -->
        <div class="badge-wrapper">
          <div class="cta-badge">
            <span class="badge-pulse"></span>
            <span class="badge-dot"></span>
            <span class="badge-text">Disponible ahora</span>
          </div>
        </div>

        <!-- Main Heading -->
        <h2 class="cta-title">
          <span class="title-line">Empieza a mejorar la</span>
          <span class="title-highlight">
            <span class="highlight-text">adherencia</span>
            <svg class="highlight-stroke" viewBox="0 0 240 20" preserveAspectRatio="none">
              <path d="M0,15 Q60,5 120,15 T240,15" fill="none" stroke="url(#cta-gradient)" stroke-width="4" stroke-linecap="round"/>
              <defs>
                <linearGradient id="cta-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#e75c3e"/>
                  <stop offset="100%" stop-color="#efc048"/>
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span class="title-line">de tus pacientes hoy</span>
        </h2>

        <!-- Subtitle -->
        <p class="cta-subtitle">
          Registrate gratis y transforma la forma en que tus pacientes siguen sus tratamientos de fisioterapia.
        </p>

        <!-- CTA Buttons -->
        <div class="cta-buttons">
          <a href="https://app.kengoapp.com/registro" class="btn-primary">
            <span class="btn-bg"></span>
            <span class="btn-content">
              <span>Crear cuenta gratuita</span>
              <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"/>
                <path d="M12 5l7 7-7 7"/>
              </svg>
            </span>
          </a>
          <a href="#como-funciona" class="btn-secondary">
            <span class="btn-glass"></span>
            <span class="btn-content">
              <svg class="play-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/>
              </svg>
              <span>Ver como funciona</span>
            </span>
          </a>
        </div>

        <!-- Trust Badges -->
        <div class="trust-badges">
          @for (badge of trustBadges; track badge.text) {
            <div class="trust-badge">
              <div class="badge-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12l5 5L20 7"/>
                </svg>
              </div>
              <span class="badge-label">{{ badge.text }}</span>
            </div>
          }
        </div>

        <!-- Stats Grid -->
        <div class="stats-container">
          <div class="stats-glass">
            <div class="stats-grid">
              @for (stat of stats; track stat.label; let i = $index) {
                <div class="stat-item" [style.--index]="i">
                  <div class="stat-icon">
                    @switch (stat.icon) {
                      @case ('exercises') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="3"/>
                          <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/>
                        </svg>
                      }
                      @case ('patients') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                      }
                      @case ('rating') {
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      }
                      @case ('adherence') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                      }
                    }
                  </div>
                  <div class="stat-data">
                    <span class="stat-value">{{ stat.value }}</span>
                    <span class="stat-label">{{ stat.label }}</span>
                  </div>
                  @if (i < stats.length - 1) {
                    <div class="stat-divider"></div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ========================================
       CTA SECTION - Premium Kengo Style
       Warm Glassmorphism + Fluid Waves
    ======================================== */

    .cta-section {
      position: relative;
      padding: 6rem 1.5rem 7rem;
      overflow: hidden;
      min-height: 80vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    @media (min-width: 768px) {
      .cta-section {
        padding: 8rem 2rem 9rem;
      }
    }

    @media (min-width: 1024px) {
      .cta-section {
        padding: 10rem 3rem 12rem;
      }
    }

    /* ----------------------------------------
       Layered Background
    ---------------------------------------- */
    .cta-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
    }

    .gradient-base {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(
          180deg,
          #fff 0%,
          #fffaf5 15%,
          #fff5eb 40%,
          #ffedde 70%,
          #ffe4d0 100%
        );
    }

    /* Animated Wave Layers */
    .wave-layer {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: auto;
      min-height: 180px;
    }

    .wave-1 path {
      fill: rgba(231, 92, 62, 0.08);
    }

    .wave-2 path {
      fill: rgba(239, 192, 72, 0.06);
    }

    .wave-3 path {
      fill: rgba(231, 92, 62, 0.04);
    }

    .wave-1 {
      animation: waveMove1 25s ease-in-out infinite;
    }

    .wave-2 {
      animation: waveMove2 20s ease-in-out infinite;
      animation-delay: -5s;
    }

    .wave-3 {
      animation: waveMove3 30s ease-in-out infinite;
      animation-delay: -10s;
    }

    @keyframes waveMove1 {
      0%, 100% { transform: translateX(0) translateY(0); }
      25% { transform: translateX(-2%) translateY(-8px); }
      50% { transform: translateX(0) translateY(-4px); }
      75% { transform: translateX(2%) translateY(-12px); }
    }

    @keyframes waveMove2 {
      0%, 100% { transform: translateX(0) translateY(0); }
      33% { transform: translateX(3%) translateY(-10px); }
      66% { transform: translateX(-1%) translateY(-6px); }
    }

    @keyframes waveMove3 {
      0%, 100% { transform: translateX(0) translateY(0); }
      50% { transform: translateX(-2%) translateY(-8px); }
    }

    /* Aurora Orbs */
    .aurora-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
    }

    .aurora-orb-1 {
      width: 500px;
      height: 500px;
      top: -15%;
      left: -10%;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.35) 0%, transparent 70%);
      animation: auroraFloat1 20s ease-in-out infinite;
    }

    .aurora-orb-2 {
      width: 450px;
      height: 450px;
      bottom: -10%;
      right: -15%;
      background: radial-gradient(circle, rgba(239, 192, 72, 0.3) 0%, transparent 70%);
      animation: auroraFloat2 25s ease-in-out infinite;
    }

    .aurora-orb-3 {
      width: 350px;
      height: 350px;
      top: 40%;
      right: 20%;
      background: radial-gradient(circle, rgba(255, 180, 150, 0.25) 0%, transparent 70%);
      animation: auroraFloat3 18s ease-in-out infinite;
    }

    .aurora-orb-4 {
      width: 300px;
      height: 300px;
      bottom: 20%;
      left: 15%;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.2) 0%, transparent 70%);
      animation: auroraFloat4 22s ease-in-out infinite;
    }

    @keyframes auroraFloat1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(60px, 40px) scale(1.15); }
      66% { transform: translate(-30px, 60px) scale(1.05); }
    }

    @keyframes auroraFloat2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(-50px, -40px) scale(1.1); }
      66% { transform: translate(40px, -60px) scale(1.2); }
    }

    @keyframes auroraFloat3 {
      0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
      50% { transform: translate(-60px, 30px) scale(1.25); opacity: 1; }
    }

    @keyframes auroraFloat4 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(40px, -50px) scale(1.15); }
    }

    /* Grain Texture */
    .grain-overlay {
      position: absolute;
      inset: 0;
      opacity: 0.03;
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    }

    /* ----------------------------------------
       Floating Decorative Shapes
    ---------------------------------------- */
    .floating-shapes {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }

    .shape {
      position: absolute;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.1), rgba(239, 192, 72, 0.08));
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .shape-1 {
      width: 120px;
      height: 120px;
      top: 10%;
      left: 8%;
      animation: shapeFloat1 15s ease-in-out infinite;
    }

    .shape-2 {
      width: 80px;
      height: 80px;
      top: 25%;
      right: 12%;
      animation: shapeFloat2 12s ease-in-out infinite;
    }

    .shape-3 {
      width: 60px;
      height: 60px;
      bottom: 30%;
      left: 15%;
      animation: shapeFloat3 18s ease-in-out infinite;
    }

    @keyframes shapeFloat1 {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      50% { transform: translate(20px, 30px) rotate(180deg); }
    }

    @keyframes shapeFloat2 {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      50% { transform: translate(-25px, 15px) rotate(-90deg); }
    }

    @keyframes shapeFloat3 {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      50% { transform: translate(15px, -20px) rotate(120deg); }
    }

    /* ----------------------------------------
       Content Container
    ---------------------------------------- */
    .cta-content {
      position: relative;
      z-index: 1;
      max-width: 900px;
      width: 100%;
      margin: 0 auto;
      text-align: center;
    }

    /* ----------------------------------------
       Badge
    ---------------------------------------- */
    .badge-wrapper {
      margin-bottom: 2rem;
      animation: fadeInUp 0.6s ease-out backwards;
    }

    .cta-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.625rem 1.25rem;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 100px;
      box-shadow:
        0 4px 24px rgba(231, 92, 62, 0.08),
        0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .badge-pulse {
      position: absolute;
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      animation: badgePulse 2s ease-in-out infinite;
    }

    .badge-dot {
      position: relative;
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
    }

    @keyframes badgePulse {
      0%, 100% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(2); opacity: 0; }
    }

    .badge-text {
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      letter-spacing: 0.01em;
    }

    /* ----------------------------------------
       Title
    ---------------------------------------- */
    .cta-title {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: clamp(2rem, 6vw, 3.5rem);
      font-weight: 700;
      color: #1f2937;
      line-height: 1.15;
      margin-bottom: 1.5rem;
      animation: fadeInUp 0.6s ease-out 0.1s backwards;
    }

    .title-line {
      display: block;
    }

    .title-highlight {
      display: inline-block;
      position: relative;
      color: #e75c3e;
    }

    .highlight-text {
      position: relative;
      z-index: 1;
    }

    .highlight-stroke {
      position: absolute;
      bottom: -0.1em;
      left: -5%;
      width: 110%;
      height: 0.5em;
      opacity: 0.6;
      animation: strokeDraw 1s ease-out 0.8s backwards;
    }

    @keyframes strokeDraw {
      from {
        stroke-dasharray: 300;
        stroke-dashoffset: 300;
      }
      to {
        stroke-dasharray: 300;
        stroke-dashoffset: 0;
      }
    }

    /* ----------------------------------------
       Subtitle
    ---------------------------------------- */
    .cta-subtitle {
      font-size: clamp(1rem, 2.5vw, 1.25rem);
      color: #4b5563;
      line-height: 1.7;
      max-width: 600px;
      margin: 0 auto 2.5rem;
      animation: fadeInUp 0.6s ease-out 0.2s backwards;
    }

    /* ----------------------------------------
       CTA Buttons
    ---------------------------------------- */
    .cta-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      justify-content: center;
      margin-bottom: 3rem;
      animation: fadeInUp 0.6s ease-out 0.3s backwards;
    }

    @media (min-width: 640px) {
      .cta-buttons {
        flex-direction: row;
        gap: 1.25rem;
      }
    }

    /* Primary Button */
    .btn-primary {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 56px;
      padding: 0 2rem;
      border-radius: 16px;
      text-decoration: none;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .btn-primary .btn-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d30 50%, #c94a2f 100%);
      transition: transform 0.4s ease;
    }

    .btn-primary:hover .btn-bg {
      transform: scale(1.02);
    }

    .btn-primary .btn-content {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: white;
      font-size: 1.0625rem;
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    .btn-primary .btn-icon {
      width: 20px;
      height: 20px;
      transition: transform 0.3s ease;
    }

    .btn-primary:hover .btn-icon {
      transform: translateX(4px);
    }

    .btn-primary:hover {
      transform: translateY(-3px);
      box-shadow:
        0 12px 32px rgba(231, 92, 62, 0.4),
        0 4px 12px rgba(231, 92, 62, 0.2);
    }

    .btn-primary:active {
      transform: translateY(-1px) scale(0.98);
    }

    /* Secondary Button */
    .btn-secondary {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 56px;
      padding: 0 2rem;
      border-radius: 16px;
      text-decoration: none;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .btn-secondary .btn-glass {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1.5px solid rgba(255, 255, 255, 0.5);
      border-radius: 16px;
      transition: all 0.3s ease;
    }

    .btn-secondary:hover .btn-glass {
      background: rgba(255, 255, 255, 0.9);
      border-color: rgba(231, 92, 62, 0.3);
    }

    .btn-secondary .btn-content {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #374151;
      font-size: 1.0625rem;
      font-weight: 600;
    }

    .btn-secondary .play-icon {
      width: 22px;
      height: 22px;
      color: #e75c3e;
      transition: transform 0.3s ease;
    }

    .btn-secondary:hover .play-icon {
      transform: scale(1.1);
    }

    .btn-secondary:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    }

    .btn-secondary:active {
      transform: translateY(-1px) scale(0.98);
    }

    /* ----------------------------------------
       Trust Badges
    ---------------------------------------- */
    .trust-badges {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.5rem 2.5rem;
      margin-bottom: 3.5rem;
      animation: fadeInUp 0.6s ease-out 0.4s backwards;
    }

    .trust-badge {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .badge-check {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.08));
      border-radius: 50%;
    }

    .badge-check svg {
      width: 12px;
      height: 12px;
      color: #22c55e;
    }

    .badge-label {
      font-size: 0.9375rem;
      font-weight: 500;
      color: #4b5563;
    }

    /* ----------------------------------------
       Stats Container
    ---------------------------------------- */
    .stats-container {
      animation: fadeInUp 0.6s ease-out 0.5s backwards;
    }

    .stats-glass {
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 24px;
      padding: 1.5rem;
      box-shadow:
        0 8px 32px rgba(231, 92, 62, 0.06),
        0 2px 8px rgba(0, 0, 0, 0.04);
    }

    @media (min-width: 768px) {
      .stats-glass {
        padding: 1.75rem 2.5rem;
        border-radius: 28px;
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;
    }

    @media (min-width: 768px) {
      .stats-grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 0;
      }
    }

    .stat-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      animation: statPop 0.5s ease-out calc(0.5s + var(--index) * 0.08s) backwards;
    }

    @keyframes statPop {
      from {
        opacity: 0;
        transform: scale(0.9) translateY(10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @media (min-width: 768px) {
      .stat-item {
        padding: 0.5rem 1.5rem;
      }
    }

    .stat-divider {
      display: none;
    }

    @media (min-width: 768px) {
      .stat-divider {
        display: block;
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 1px;
        height: 50%;
        background: linear-gradient(
          180deg,
          transparent,
          rgba(231, 92, 62, 0.15),
          transparent
        );
      }
    }

    .stat-icon {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.12), rgba(239, 192, 72, 0.08));
      border-radius: 14px;
      transition: all 0.3s ease;
    }

    .stat-item:hover .stat-icon {
      transform: scale(1.1) rotate(-5deg);
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.18), rgba(239, 192, 72, 0.12));
    }

    .stat-icon svg {
      width: 22px;
      height: 22px;
      color: #e75c3e;
    }

    .stat-data {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.125rem;
    }

    .stat-value {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: 1.625rem;
      font-weight: 700;
      color: #e75c3e;
      line-height: 1;
    }

    @media (min-width: 768px) {
      .stat-value {
        font-size: 1.875rem;
      }
    }

    .stat-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: #6b7280;
      text-transform: capitalize;
    }

    /* ----------------------------------------
       Animations
    ---------------------------------------- */
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

    /* ----------------------------------------
       Reduced Motion
    ---------------------------------------- */
    @media (prefers-reduced-motion: reduce) {
      .wave-layer,
      .aurora-orb,
      .shape,
      .badge-pulse,
      .highlight-stroke {
        animation: none;
      }

      .badge-wrapper,
      .cta-title,
      .cta-subtitle,
      .cta-buttons,
      .trust-badges,
      .stats-container,
      .stat-item {
        animation: none;
        opacity: 1;
        transform: none;
      }
    }
  `]
})
export class CtaComponent {
  trustBadges = [
    { text: 'Sin tarjeta de credito' },
    { text: 'Configuracion en 2 minutos' },
    { text: 'Cancela cuando quieras' },
  ];

  stats = [
    { value: '+500', label: 'Ejercicios', icon: 'exercises' },
    { value: '+1.000', label: 'Pacientes', icon: 'patients' },
    { value: '4.9', label: 'Valoracion', icon: 'rating' },
    { value: '95%', label: 'Adherencia', icon: 'adherence' },
  ];
}
