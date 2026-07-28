import { Component } from '@angular/core';

interface Kpi {
  value: string;
  label: string;
}

@Component({
  selector: 'web-stats',
  standalone: true,
  template: `
    <section class="stats">
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
        color: var(--color-primary);
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
    `,
  ],
})
export class StatsComponent {
  kpis: Kpi[] = [
    { value: '422', label: 'ejercicios grabados en vídeo, listos para asignar' },
    { value: '87%', label: 'de adherencia media en pacientes con plan activo' },
    { value: '2 min', label: 'para montar un plan completo desde una rutina' },
    { value: '3', label: 'perfiles: fisio, paciente y administrador de clínica' },
  ];
}
