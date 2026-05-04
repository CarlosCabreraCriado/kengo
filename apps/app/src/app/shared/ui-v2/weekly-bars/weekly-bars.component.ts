import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface Ui2WeeklyBar {
  label: string;
  value: number;
}

/**
 * Mini-chart V2 — N barras verticales para mostrar tendencias semanales (0-100%).
 * Color coral para barras con valor > 0; gris si valor = 0. Etiqueta `value%` arriba y `label` abajo.
 */
@Component({
  selector: 'ui2-weekly-bars',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-wb" role="img" [attr.aria-label]="ariaLabel()">
      @for (bar of data(); track $index) {
        <div class="ui2-wb__col">
          <span class="ui2-wb__value" [class.ui2-wb__value--muted]="bar.value === 0">
            {{ bar.value }}%
          </span>
          <div class="ui2-wb__bar-wrap">
            <div
              class="ui2-wb__bar"
              [class.ui2-wb__bar--empty]="bar.value === 0"
              [style.height.%]="height(bar.value)"
              [style.background]="fill(bar.value)"
            ></div>
          </div>
          <span class="ui2-wb__label">{{ bar.label }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .ui2-wb {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 10px;
        align-items: end;
      }
      .ui2-wb__col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .ui2-wb__value {
        font-size: 11px;
        font-weight: 700;
        color: var(--ink-700);
        line-height: 1;
      }
      .ui2-wb__value--muted {
        color: var(--ink-400);
      }
      .ui2-wb__bar-wrap {
        width: 100%;
        height: 110px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
      }
      .ui2-wb__bar {
        width: 100%;
        min-height: 8px;
        border-radius: 10px 10px 6px 6px;
        transition: height 400ms ease;
      }
      .ui2-wb__bar--empty {
        background: rgba(0, 0, 0, 0.06) !important;
      }
      .ui2-wb__label {
        font-size: 10px;
        font-weight: 700;
        color: var(--ink-500);
        text-transform: uppercase;
        letter-spacing: 0.4px;
        line-height: 1;
      }
    `,
  ],
})
export class Ui2WeeklyBarsComponent {
  readonly data = input.required<Ui2WeeklyBar[]>();
  readonly color = input<string>('var(--kengo-primary)');

  height(value: number): number {
    if (value <= 0) return 8;
    const v = Math.min(100, Math.max(0, value));
    return Math.max(8, (v / 100) * 100);
  }

  fill(value: number): string {
    if (value <= 0) return 'rgba(0, 0, 0, 0.06)';
    if (value >= 90) {
      return 'linear-gradient(180deg, var(--kengo-primary), var(--kengo-primary-dark))';
    }
    return 'linear-gradient(180deg, var(--kengo-primary-light), var(--kengo-primary))';
  }

  ariaLabel(): string {
    const arr = this.data();
    return arr.map((b) => `${b.label}: ${b.value}%`).join(', ');
  }
}
