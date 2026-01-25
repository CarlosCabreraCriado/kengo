import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-divider',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ui-divider" [class]="dividerClasses" role="separator">
      @if (label) {
        <span class="ui-divider-label">{{ label }}</span>
      }
    </div>
  `,
  styles: [`
    .ui-divider {
      display: flex;
      align-items: center;
      color: #9ca3af;
    }

    .ui-divider.horizontal {
      width: 100%;
    }

    .ui-divider.horizontal::before,
    .ui-divider.horizontal::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid #e5e7eb;
    }

    .ui-divider.vertical {
      flex-direction: column;
      height: 100%;
      min-height: 1.5rem;
    }

    .ui-divider.vertical::before,
    .ui-divider.vertical::after {
      content: '';
      flex: 1;
      border-left: 1px solid #e5e7eb;
    }

    .ui-divider-label {
      padding: 0 0.75rem;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }

    .ui-divider.vertical .ui-divider-label {
      padding: 0.5rem 0;
      writing-mode: vertical-rl;
      text-orientation: mixed;
    }
  `]
})
export class DividerComponent {
  @Input() orientation: 'horizontal' | 'vertical' = 'horizontal';
  @Input() label?: string;

  get dividerClasses(): string {
    return this.orientation;
  }
}
