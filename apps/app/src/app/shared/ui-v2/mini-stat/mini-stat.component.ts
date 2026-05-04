import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Ui2IconBadgeComponent } from '../icon-badge/icon-badge.component';

/**
 * Mini stat V2 — fila con icon badge + label uppercase + valor grande (KengoDisplay) + sub-delta opcional.
 * Usado en el hero desktop de `/inicio/paciente` (Racha, Adherencia, Dolor).
 */
@Component({
  selector: 'ui2-mini-stat',
  standalone: true,
  imports: [Ui2IconBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-mini-stat">
      <ui2-icon-badge
        [icon]="icon()"
        [color]="color()"
        [size]="36"
        [radius]="10"
      ></ui2-icon-badge>
      <div class="ui2-mini-stat__text">
        <span class="ui2-mini-stat__label">{{ label() }}</span>
        <span class="ui2-mini-stat__value">{{ value() }}</span>
        @if (sub()) {
          <span class="ui2-mini-stat__sub" [style.color]="subColor()">{{ sub() }}</span>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-mini-stat {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 130px;
    }
    .ui2-mini-stat__text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .ui2-mini-stat__label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--ink-500);
      text-transform: uppercase;
      line-height: 1;
    }
    .ui2-mini-stat__value {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 18px;
      color: var(--ink-900);
      line-height: 1;
      margin-top: 4px;
    }
    .ui2-mini-stat__sub {
      font-size: 10px;
      font-weight: 700;
      margin-top: 3px;
      line-height: 1;
    }
  `],
})
export class Ui2MiniStatComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly sub = input<string | null>(null);
  readonly color = input<string>('var(--kengo-primary)');
  readonly subColor = input<string>('var(--success)');
}
