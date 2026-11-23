import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CLINICAS_USUARIAS, TRIAL_DIAS } from '../../shared/site-config';

interface Kpi {
  value: string;
  label: string;
}

/**
 * Cifras de la franja bajo el hero. Solo datos reales y comprobables: nada de
 * porcentajes de adherencia o resultados que no podamos respaldar.
 */
@Component({
  selector: 'web-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <section class="stats" aria-label="Kengo en cifras">
      <div class="wrap">
        <div class="stats-in">
          @for (kpi of kpis; track kpi.value) {
            <div class="stat">
              <b class="font-display">{{ kpi.value }}</b>
              <span>{{ kpi.label }}</span>
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

      .stats {
        position: relative;
        z-index: 5;
        background: var(--color-cream);
        padding: 0 0 8px;
      }

      .stats-in {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        background: #fff;
        border: 1px solid var(--color-ink-200);
        border-radius: 32px;
        box-shadow: 0 18px 48px rgba(150, 100, 70, 0.1);
        overflow: hidden;
      }

      .stat {
        padding: 34px 30px;
        border-right: 1px solid var(--color-ink-200);
      }

      .stat:last-child {
        border-right: 0;
      }

      .stat b {
        display: block;
        font-size: 42px;
        line-height: 1;
        color: var(--color-primary-dark);
        letter-spacing: 0.02em;
      }

      .stat span {
        display: block;
        margin-top: 10px;
        font-size: 13.5px;
        line-height: 1.5;
        color: var(--color-ink-700);
      }

      @media (max-width: 1080px) {
        .stats-in {
          grid-template-columns: repeat(2, 1fr);
        }
        .stat:nth-child(2) {
          border-right: 0;
        }
        .stat:nth-child(1),
        .stat:nth-child(2) {
          border-bottom: 1px solid var(--color-ink-200);
        }
      }

      @media (max-width: 640px) {
        .stats {
          padding-top: 24px;
        }
        .stats-in {
          border-radius: 24px;
        }
        .stat {
          padding: 22px 18px;
        }
        .stat b {
          font-size: 32px;
        }
        .stat span {
          font-size: 12.5px;
        }
      }
    `,
  ],
})
export class StatsComponent {
  protected readonly kpis: Kpi[] = [
    { value: String(CLINICAS_USUARIAS), label: 'clínicas ya trabajan con Kengo' },
    { value: `${TRIAL_DIAS} días`, label: 'de prueba gratis, sin tarjeta' },
    { value: '<2 min', label: 'para montar un plan completo desde una rutina' },
    { value: '0', label: 'permanencia: cancelas cuando quieras' },
  ];
}
