import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Ui2ButtonComponent } from '../button/button.component';
import { Ui2IconBadgeComponent } from '../icon-badge/icon-badge.component';

/**
 * Empty state V2 — IconBadge grande coral-soft + título KengoDisplay + mensaje + CTA opcional.
 */
@Component({
  selector: 'ui2-empty-state',
  standalone: true,
  imports: [Ui2ButtonComponent, Ui2IconBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-empty">
      <ui2-icon-badge [icon]="icon()" [size]="64" [radius]="20"></ui2-icon-badge>
      <h2 class="ui2-empty__title">{{ title() }}</h2>
      @if (message()) {
        <p class="ui2-empty__message">{{ message() }}</p>
      }
      @if (actionLabel()) {
        <ui2-button
          variant="primary"
          [iconLeft]="actionIcon()"
          (clicked)="action.emit()"
        >{{ actionLabel() }}</ui2-button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 36px 24px;
      text-align: center;
    }
    .ui2-empty__title {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 28px;
      color: var(--kengo-primary);
      line-height: 1;
      letter-spacing: -0.3px;
      margin: 4px 0 0;
    }
    .ui2-empty__message {
      font-size: 14px;
      color: var(--ink-500);
      line-height: 1.45;
      margin: 0;
      max-width: 28ch;
    }
  `],
})
export class Ui2EmptyStateComponent {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  readonly actionIcon = input<string>('add');
  readonly action = output<void>();
}
