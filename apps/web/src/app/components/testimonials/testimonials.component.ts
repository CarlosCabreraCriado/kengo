import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-testimonials',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="testimonials-section">
      <div class="content-wrapper">
        <!-- Header -->
        <div class="section-header">
          <div class="badge-row">
            <span class="header-line"></span>
            <span class="header-badge">Lo que dicen nuestros usuarios</span>
            <span class="header-line"></span>
          </div>
          <h2 class="section-title">
            Resultados <span class="title-accent">reales</span>
          </h2>
          <p class="section-subtitle">
            Fisioterapeutas y pacientes que ya transformaron su forma de trabajar.
          </p>
        </div>

        <!-- Testimonials Grid -->
        <div class="testimonials-grid">
          @for (t of testimonials; track t.name) {
            <article class="testimonial-card">
              <!-- Quote Icon -->
              <div class="quote-icon">
                <svg viewBox="0 0 32 32" fill="currentColor">
                  <path d="M10 8C7.8 8 6 9.8 6 12v4c0 2.2 1.8 4 4 4h1l-2 6h3l2.5-7A4 4 0 0014 15v-3c0-2.2-1.8-4-4-4zm12 0c-2.2 0-4 1.8-4 4v4c0 2.2 1.8 4 4 4h1l-2 6h3l2.5-7A4 4 0 0026 15v-3c0-2.2-1.8-4-4-4z"/>
                </svg>
              </div>

              <!-- Stars -->
              <div class="stars">
                @for (s of [1,2,3,4,5]; track s) {
                  <svg class="star" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                }
              </div>

              <!-- Quote text -->
              <p class="quote-text">"{{ t.quote }}"</p>

              <!-- Result badge -->
              @if (t.result) {
                <div class="result-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <path d="M22 4L12 14.01l-3-3"/>
                  </svg>
                  {{ t.result }}
                </div>
              }

              <!-- Author -->
              <div class="author-row">
                <div class="author-avatar" [style.background]="t.avatarGradient">
                  <span class="author-initial">{{ t.name[0] }}</span>
                </div>
                <div class="author-info">
                  <span class="author-name">{{ t.name }}</span>
                  <span class="author-role">{{ t.role }}</span>
                </div>
                <div class="clinic-badge">
                  <span>{{ t.clinic }}</span>
                </div>
              </div>
            </article>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .testimonials-section {
      padding: 6rem 0 7rem;
      background: #fafaf9;
    }

    .content-wrapper {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    @media (min-width: 640px) { .content-wrapper { padding: 0 2rem; } }
    @media (min-width: 1024px) { .content-wrapper { padding: 0 3rem; } }

    /* Header */
    .section-header {
      text-align: center;
      max-width: 700px;
      margin: 0 auto 4rem;
    }

    .badge-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .header-line {
      flex: 1;
      max-width: 60px;
      height: 1px;
      background: linear-gradient(90deg, transparent, #e75c3e);
    }

    .header-line:last-child {
      background: linear-gradient(90deg, #e75c3e, transparent);
    }

    .header-badge {
      font-size: 13px;
      font-weight: 700;
      color: #e75c3e;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .section-title {
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: clamp(2rem, 5vw, 3.25rem);
      font-weight: 700;
      color: #1f2937;
      letter-spacing: -0.02em;
      margin-bottom: 1rem;
    }

    .title-accent {
      color: #e75c3e;
    }

    .section-subtitle {
      font-size: 1.0625rem;
      color: #6b7280;
      line-height: 1.7;
    }

    /* Grid */
    .testimonials-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    @media (min-width: 768px) {
      .testimonials-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (min-width: 1024px) {
      .testimonials-grid { grid-template-columns: repeat(3, 1fr); }
    }

    /* Card */
    .testimonial-card {
      background: white;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 24px;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      transition: box-shadow 0.3s ease, transform 0.3s ease;
    }

    .testimonial-card:hover {
      box-shadow: 0 8px 32px rgba(231, 92, 62, 0.1);
      transform: translateY(-4px);
    }

    /* Quote icon */
    .quote-icon {
      width: 32px;
      height: 32px;
      color: rgba(231, 92, 62, 0.25);
    }

    .quote-icon svg {
      width: 100%;
      height: 100%;
    }

    /* Stars */
    .stars {
      display: flex;
      gap: 2px;
    }

    .star {
      width: 16px;
      height: 16px;
      color: #efc048;
    }

    /* Quote text */
    .quote-text {
      font-size: 15px;
      line-height: 1.7;
      color: #374151;
      flex: 1;
    }

    /* Result badge */
    .result-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(34, 197, 94, 0.1);
      color: #16a34a;
      font-size: 12px;
      font-weight: 700;
      border-radius: 100px;
      align-self: flex-start;
    }

    .result-badge svg {
      width: 14px;
      height: 14px;
    }

    /* Author */
    .author-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-top: 1rem;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }

    .author-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .author-initial {
      font-size: 16px;
      font-weight: 700;
      color: white;
    }

    .author-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .author-name {
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
    }

    .author-role {
      font-size: 12px;
      color: #6b7280;
    }

    .clinic-badge {
      font-size: 11px;
      font-weight: 600;
      color: #9ca3af;
      background: #f3f4f6;
      padding: 4px 10px;
      border-radius: 100px;
      white-space: nowrap;
    }

    @media (prefers-reduced-motion: reduce) {
      .testimonial-card { transition: none; }
    }
  `]
})
export class TestimonialsComponent {
  testimonials = [
    {
      name: 'Maria Garcia',
      role: 'Fisioterapeuta',
      clinic: 'Clinica Fisio Norte',
      quote: 'Mis pacientes ahora completan el 90% de sus ejercicios. Antes con las hojas de papel apenas llegaban al 40%. La diferencia es brutal.',
      result: '+50% adherencia en 3 meses',
      avatarGradient: 'linear-gradient(135deg, #e75c3e, #c94a2f)',
    },
    {
      name: 'Carlos Ruiz',
      role: 'Paciente',
      clinic: 'Rehabilitacion lumbar',
      quote: 'Me encanta poder ver exactamente como hacer cada ejercicio con el video. Ya no tengo dudas ni miedo de hacerlo mal cuando estoy en casa.',
      result: 'Recuperacion en 8 semanas',
      avatarGradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    },
    {
      name: 'Laura Sanchez',
      role: 'Directora de clinica',
      clinic: 'FisioSalud Madrid',
      quote: 'Gestionamos 3 clinicas con 12 fisios desde un solo lugar. Los codigos de acceso simplificaron enormemente la incorporacion de nuevos pacientes.',
      result: 'Equipo de 12 fisios conectados',
      avatarGradient: 'linear-gradient(135deg, #efc048, #d97706)',
    },
  ];
}
