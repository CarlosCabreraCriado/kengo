import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Date tile V2 — tile coral 64×~80 con weekday (10px) / day (28px KengoDisplay) / month (10px).
 */
@Component({
  selector: 'ui2-date-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-date-tile" [style.background]="color()">
      <div class="ui2-date-tile__weekday">{{ weekday() }}</div>
      <div class="ui2-date-tile__day">{{ day() }}</div>
      <div class="ui2-date-tile__month">{{ month() }}</div>
    </div>
  `,
  styles: [`
    :host { display: inline-block; flex-shrink: 0; }
    .ui2-date-tile {
      width: 64px;
      text-align: center;
      color: white;
      border-radius: 16px;
      padding: 10px 0;
      box-shadow: 0 6px 14px -3px rgba(var(--kengo-primary-rgb), 0.4);
    }
    .ui2-date-tile__weekday {
      font-size: 10px;
      letter-spacing: 1px;
      font-weight: 700;
      opacity: 0.9;
      text-transform: uppercase;
    }
    .ui2-date-tile__day {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 28px;
      line-height: 1;
      margin-top: 2px;
    }
    .ui2-date-tile__month {
      font-size: 10px;
      opacity: 0.85;
      margin-top: 2px;
      text-transform: uppercase;
    }
  `],
})
export class Ui2DateTileComponent {
  readonly weekday = input.required<string>();
  readonly day = input.required<string | number>();
  readonly month = input.required<string>();
  readonly color = input<string>('var(--kengo-primary)');
}
