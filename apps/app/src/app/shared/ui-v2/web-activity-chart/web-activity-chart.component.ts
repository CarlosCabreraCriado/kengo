import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { Ui2CardComponent } from '../card/card.component';
import { Ui2PillComponent } from '../pill/pill.component';

export interface Ui2ActivityDay {
  label: string;
  value: number;
  today?: boolean;
}

/**
 * Web activity chart V2 — card con header (eyebrow + título + delta + pill "Esta semana") + 10 barras verticales.
 * Lógica de fill: today (rayas), value≥1 (gradient coral fuerte), value>0 (gradient claro), value=0 (gris).
 * Usado solo en vista desktop.
 */
@Component({
  selector: 'ui2-web-activity-chart',
  standalone: true,
  imports: [Ui2CardComponent, Ui2PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui2-card [padding]="20">
      <header class="ui2-wac__head">
        <div class="ui2-wac__head-text">
          <span class="ui2-wac__eyebrow">{{ eyebrow() }}</span>
          <h3 class="ui2-wac__title">{{ title() ?? autoTitle() }}</h3>
          @if (delta()) {
            <span class="ui2-wac__delta" [style.color]="deltaColor()">{{
              delta()
            }}</span>
          }
        </div>
        @if (pillLabel()) {
          <ui2-pill variant="soft" size="md">{{ pillLabel() }}</ui2-pill>
        }
      </header>

      <div class="ui2-wac__chart" role="img" [attr.aria-label]="title()">
        @for (d of data(); track $index) {
          <div class="ui2-wac__bar-col">
            <div
              class="ui2-wac__bar"
              [style.height.%]="barHeight(d.value)"
              [style.background]="barFill(d)"
            ></div>
            <span
              class="ui2-wac__day-label"
              [class.ui2-wac__day-label--today]="d.today"
              >{{ d.label }}</span
            >
          </div>
        }
      </div>
    </ui2-card>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .ui2-wac__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 18px;
      }
      .ui2-wac__head-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .ui2-wac__eyebrow {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--ink-500);
        line-height: 1;
      }
      .ui2-wac__title {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 28px;
        letter-spacing: -0.3px;
        color: var(--ink-900);
        line-height: 1;
        margin: 6px 0 0;
      }
      .ui2-wac__delta {
        font-size: 12px;
        font-weight: 700;
        margin-top: 4px;
        line-height: 1;
      }
      .ui2-wac__chart {
        display: flex;
        gap: 8px;
        align-items: flex-end;
        height: 120px;
      }
      .ui2-wac__bar-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        height: 100%;
        justify-content: flex-end;
      }
      .ui2-wac__bar {
        width: 100%;
        min-height: 4px;
        border-radius: 8px;
        transition: height 0.3s ease;
      }
      .ui2-wac__day-label {
        font-size: 10px;
        font-weight: 700;
        color: var(--ink-400);
        line-height: 1;
        text-wrap-mode: nowrap;
      }
      .ui2-wac__day-label--today {
        color: var(--kengo-primary);
      }
    `,
  ],
})
export class Ui2WebActivityChartComponent {
  readonly eyebrow = input<string>('Actividad · 10 días');
  readonly title = input<string | null>(null);
  readonly delta = input<string | null>(null);
  readonly deltaColor = input<string>('var(--success)');
  readonly pillLabel = input<string | null>(null);
  readonly data = input.required<Ui2ActivityDay[]>();

  readonly autoTitle = computed<string>(() => {
    const items = this.data();
    const total = items.length;
    const activos = items.filter((d) => d.value > 0).length;
    return `${activos} DE ${total} DÍAS`;
  });

  barHeight(value: number): number {
    return Math.max(value * 100, 3);
  }

  barFill(d: Ui2ActivityDay): string {
    if (d.value === 0) return 'rgba(0, 0, 0, 0.06)';
    if (d.today) {
      return 'repeating-linear-gradient(45deg, var(--kengo-primary), var(--kengo-primary) 4px, var(--kengo-primary-light) 4px, var(--kengo-primary-light) 8px)';
    }
    if (d.value >= 1) {
      return 'linear-gradient(180deg, var(--kengo-primary), var(--kengo-primary-dark))';
    }
    return 'linear-gradient(180deg, var(--kengo-primary-light), var(--kengo-primary))';
  }
}
