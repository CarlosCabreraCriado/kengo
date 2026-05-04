import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-chat-day-separator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="day">
      <span class="day__line"></span>
      <span class="day__label">{{ label() }}</span>
      <span class="day__line"></span>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 8px 0; }
    .day {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .day__line {
      flex: 1;
      height: 1px;
      background: rgba(0, 0, 0, 0.06);
    }
    .day__label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--ink-400);
    }
  `],
})
export class ChatDaySeparatorComponent {
  readonly label = input.required<string>();
}
