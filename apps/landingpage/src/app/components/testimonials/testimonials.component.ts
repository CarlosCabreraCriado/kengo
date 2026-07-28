import { Component } from '@angular/core';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

interface Testimonial {
  quote: string;
  result: string;
  name: string;
  role: string;
  initial: string;
  avatarBg: string;
}

@Component({
  selector: 'web-testimonials',
  standalone: true,
  imports: [ScrollAnimateDirective],
  template: `
    <section class="tests">
      <div class="wrap">
        <div class="head scroll-reveal" style="max-width:620px" webScrollAnimate>
          <span class="eyebrow">Lo que dicen</span>
          <h2 class="font-display">Resultados reales</h2>
        </div>
        <div class="test-grid scroll-reveal" webScrollAnimate>
          @for (t of testimonials; track t.name) {
            <article class="test">
              <div class="stars">
                @for (star of stars; track $index) {
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path
                      d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.37 1.12l1.07 3.29c.3.92-.75 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.17 0l-2.8 2.03c-.79.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69l1.07-3.29z"
                    />
                  </svg>
                }
              </div>
              <p class="q">{{ t.quote }}</p>
              <span class="res">{{ t.result }}</span>
              <div class="who">
                <div class="av" [style.background]="t.avatarBg">{{ t.initial }}</div>
                <div>
                  <b>{{ t.name }}</b>
                  <span>{{ t.role }}</span>
                </div>
              </div>
            </article>
          }
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .tests {
        padding: 112px 0;
        background: var(--color-cream);
      }

      .test-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 22px;
        margin-top: 52px;
      }

      .test {
        background: #fff;
        border: 1px solid var(--color-ink-200);
        border-radius: 28px;
        padding: 32px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        transition: 0.3s;
        box-shadow: 0 8px 26px rgba(150, 100, 70, 0.06);
      }

      .test:hover {
        transform: translateY(-4px);
        box-shadow: 0 18px 44px rgba(150, 100, 70, 0.12);
      }

      .test .q {
        font-size: 15.5px;
        line-height: 1.72;
        color: var(--color-ink-700);
        flex: 1;
        margin: 0;
      }

      .test .res {
        align-self: flex-start;
        font-size: 12px;
        font-weight: 700;
        padding: 6px 13px;
        border-radius: 999px;
        background: rgba(93, 138, 95, 0.14);
        color: #3f6b45;
      }

      .test .who {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid var(--color-ink-200);
      }

      .test .av {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        color: #fff;
        font-weight: 700;
        flex: none;
      }

      .test .who b {
        display: block;
        font-size: 14px;
        color: var(--color-ink);
      }

      .test .who span {
        display: block;
        font-size: 12px;
        color: var(--color-ink-500);
      }

      .stars {
        display: flex;
        gap: 2px;
        color: var(--color-tertiary);
      }

      .stars svg {
        width: 15px;
        height: 15px;
      }

      @media (max-width: 1080px) {
        .test-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class TestimonialsComponent {
  stars = [0, 1, 2, 3, 4];

  testimonials: Testimonial[] = [
    {
      quote:
        '«Mis pacientes ahora completan el 90% de sus ejercicios. Antes apenas se llegaba al 40%. La diferencia es brutal.»',
      result: '+50% adherencia en 3 meses',
      name: 'María García',
      role: 'Fisioterapeuta · Clínica Fisio Norte',
      initial: 'M',
      avatarBg: 'linear-gradient(135deg,#e0704f,#c9563a)',
    },
    {
      quote:
        '«Me encanta ver exactamente cómo hacer cada ejercicio con el vídeo. Ya no tengo dudas ni miedo de hacerlo mal cuando estoy en casa.»',
      result: 'Recuperación en 8 semanas',
      name: 'Carlos Ruiz',
      role: 'Paciente · Rehabilitación lumbar',
      initial: 'C',
      avatarBg: 'linear-gradient(135deg,#8b9ee0,#6b7fd0)',
    },
    {
      quote:
        '«Gestionamos 3 clínicas con 12 fisios desde un solo lugar. Los códigos de acceso simplificaron enormemente la incorporación de pacientes.»',
      result: 'Equipo de 12 fisios conectados',
      name: 'Laura Sánchez',
      role: 'Directora · FisioSalud Madrid',
      initial: 'L',
      avatarBg: 'linear-gradient(135deg,#f0cf7a,#dfae4a)',
    },
  ];
}
