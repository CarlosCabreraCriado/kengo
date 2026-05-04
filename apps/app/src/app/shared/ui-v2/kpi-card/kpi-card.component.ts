import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Ui2CardComponent } from '../card/card.component';
import { Ui2IconBadgeComponent } from '../icon-badge/icon-badge.component';

/**
 * KPI card V2 — Card + IconBadge + label uppercase + número grande KengoDisplay + delta opcional.
 */
@Component({
  selector: 'ui2-kpi-card',
  standalone: true,
  imports: [Ui2CardComponent, Ui2IconBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui2-card>
      <div class="ui2-kpi__head">
        <ui2-icon-badge [icon]="icon()" [color]="iconColor()" [size]="32"></ui2-icon-badge>
        <span class="ui2-kpi__label">{{ label() }}</span>
      </div>
      <div class="ui2-kpi__value">
        {{ value() }}@if (unit()) {<span class="ui2-kpi__unit">{{ unit() }}</span>}
      </div>
      @if (delta()) {
        <div class="ui2-kpi__delta" [style.color]="deltaColor()">{{ delta() }}</div>
      }
    </ui2-card>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    ui2-card { display: block; height: 100%; }
    .ui2-kpi__head {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ui2-kpi__label {
      font-size: 10px;
      font-weight: 700;
      color: var(--ink-500);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ui2-kpi__value {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 36px;
      color: var(--kengo-primary);
      line-height: 1;
      letter-spacing: -1px;
      margin-top: 10px;
    }
    .ui2-kpi__unit {
      font-size: 18px;
      color: var(--kengo-primary-light);
      margin-left: 4px;
    }
    .ui2-kpi__delta {
      font-size: 10px;
      font-weight: 700;
      margin-top: 4px;
    }
  `],
})
export class Ui2KpiCardComponent {
  readonly icon = input.required<string>();
  readonly iconColor = input<string>('var(--kengo-primary)');
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input<string | null>(null);
  readonly delta = input<string | null>(null);
  readonly deltaColor = input<string>('var(--success)');
}
