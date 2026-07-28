import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

interface Step {
  label: string;
  title: string;
  copy: string;
}

@Component({
  selector: 'web-how-it-works',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ScrollAnimateDirective],
  template: `
    <section class="steps" id="como">
      <div class="wrap">
        <div class="head scroll-reveal" webScrollAnimate>
          <span class="eyebrow">Cómo funciona</span>
          <h2 class="font-display">
            De la consulta al salón<br />de casa, en cuatro pasos
          </h2>
        </div>
        <div class="step-grid scroll-reveal" webScrollAnimate>
          @for (step of steps; track step.label) {
            <div class="step">
              <b class="font-display">{{ step.label }}</b>
              <h4>{{ step.title }}</h4>
              <p>{{ step.copy }}</p>
            </div>
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

      .steps {
        padding: 112px 0;
        background: var(--color-cream);
      }

      .step-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 22px;
        margin-top: 56px;
      }

      .step {
        position: relative;
        background: #fff;
        border: 1px solid var(--color-ink-200);
        border-radius: 26px;
        padding: 28px 26px;
      }

      .step b {
        display: block;
        font-size: 13px;
        letter-spacing: 0.2em;
        color: #a34a2c;
        margin-bottom: 12px;
      }

      .step h4 {
        margin: 0;
        font-size: 19px;
        font-weight: 700;
        color: var(--color-ink);
      }

      .step p {
        margin: 10px 0 0;
        font-size: 15px;
        line-height: 1.6;
        color: var(--color-ink-700);
      }

      @media (max-width: 1080px) {
        .step-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 640px) {
        .steps {
          padding: 76px 0;
        }
        .step-grid {
          grid-template-columns: 1fr;
          margin-top: 40px;
        }
      }
    `,
  ],
})
export class HowItWorksComponent {
  steps: Step[] = [
    {
      label: 'Paso 01',
      title: 'El fisio crea el plan',
      copy: 'Elige ejercicios del catálogo o parte de una rutina guardada y los reparte por días.',
    },
    {
      label: 'Paso 02',
      title: 'El paciente entra con un código',
      copy: 'Ocho caracteres, sin emails ni papeleo. Queda vinculado a la clínica al momento.',
    },
    {
      label: 'Paso 03',
      title: 'Hace la sesión guiada',
      copy: 'Vídeo, series y descansos. Al acabar registra su dolor y cómo se ha sentido.',
    },
    {
      label: 'Paso 04',
      title: 'El fisio ajusta sobre datos',
      copy: 'Adherencia, dolor y mensajes. El plan evoluciona antes de la siguiente cita.',
    },
  ];
}
