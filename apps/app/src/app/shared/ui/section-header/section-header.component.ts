import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

export type SectionHeaderTone = 'primary' | 'tertiary' | 'neutral' | 'security';

@Component({
  selector: 'ui-section-header',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (expandable) {
      <button
        type="button"
        class="ui-section-header"
        [class.expanded]="expanded"
        [attr.aria-expanded]="expanded"
        (click)="toggleClick()"
      >
        <div class="ui-section-header__group">
          @if (icon) {
            <span class="ui-section-header__icon" [attr.data-tone]="tone">
              <span class="material-symbols-outlined">{{ icon }}</span>
            </span>
          }
          <div class="ui-section-header__text">
            <h3 class="ui-section-header__title">{{ title }}</h3>
            @if (subtitle) {
              <p class="ui-section-header__subtitle">{{ subtitle }}</p>
            }
          </div>
        </div>
        <span
          class="material-symbols-outlined ui-section-header__chevron"
          [class.rotated]="expanded"
        >expand_more</span>
      </button>
    } @else {
      <header class="ui-section-header">
        <div class="ui-section-header__group">
          @if (icon) {
            <span class="ui-section-header__icon" [attr.data-tone]="tone">
              <span class="material-symbols-outlined">{{ icon }}</span>
            </span>
          }
          <div class="ui-section-header__text">
            <h3 class="ui-section-header__title">{{ title }}</h3>
            @if (subtitle) {
              <p class="ui-section-header__subtitle">{{ subtitle }}</p>
            }
          </div>
        </div>
        <ng-content select="[actions]"></ng-content>
      </header>
    }
  `,
  styles: [`
    :host {
      display: block;
    }

    .ui-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 0.75rem;
      padding: 0.5rem 0;
      background: none;
      border: none;
      text-align: left;
      cursor: inherit;
    }

    button.ui-section-header {
      cursor: pointer;
    }

    .ui-section-header__group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
      flex: 1;
    }

    .ui-section-header__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.75rem;
      flex-shrink: 0;
      background: rgba(var(--kengo-primary-rgb), 0.1);
      color: var(--kengo-primary);
    }

    .ui-section-header__icon[data-tone='tertiary'] {
      background: rgba(var(--kengo-tertiary-rgb), 0.15);
      color: var(--kengo-tertiary);
    }

    .ui-section-header__icon[data-tone='neutral'] {
      background: #f4f4f5;
      color: #52525b;
    }

    .ui-section-header__icon[data-tone='security'] {
      background: #fef3c7;
      color: #b45309;
    }

    .ui-section-header__icon .material-symbols-outlined {
      font-size: 1.25rem;
    }

    .ui-section-header__text {
      min-width: 0;
    }

    .ui-section-header__title {
      font-size: 1rem;
      font-weight: 600;
      color: #27272a;
      margin: 0;
    }

    .ui-section-header__subtitle {
      font-size: 0.8125rem;
      color: #71717a;
      margin: 0.125rem 0 0;
    }

    .ui-section-header__chevron {
      transition: transform 0.2s ease;
      color: #a1a1aa;
      font-size: 1.5rem;
    }

    .ui-section-header__chevron.rotated {
      transform: rotate(180deg);
    }
  `],
})
export class SectionHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() tone: SectionHeaderTone = 'primary';
  @Input() expandable = false;
  @Input() expanded = false;

  @Output() toggle = new EventEmitter<boolean>();

  toggleClick() {
    this.toggle.emit(!this.expanded);
  }
}
