import { Component, Input, Output, EventEmitter } from '@angular/core';

export type ChipVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger';
export type ChipSize = 'sm' | 'md';

@Component({
  selector: 'ui-chip',
  standalone: true,
  imports: [],
  template: `
    <span class="ui-chip" [class]="chipClasses" [class.selected]="selected" [class.clickable]="selectable">
      @if (icon) {
        <span class="material-symbols-outlined text-[1em]">{{ icon }}</span>
      }
      <span class="ui-chip-label"><ng-content></ng-content></span>
      @if (removable) {
        <button
          type="button"
          class="ui-chip-remove"
          (click)="onRemove($event)"
          aria-label="Eliminar"
        >
          <span class="material-symbols-outlined text-[0.875em]">close</span>
        </button>
      }
    </span>
  `,
  styles: [`
    .ui-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      border-radius: 9999px;
      font-weight: 500;
      transition: all 0.15s;
    }

    .ui-chip.clickable {
      cursor: pointer;
    }

    .ui-chip-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.15s;
      padding: 0;
      margin-left: 0.125rem;
    }

    .ui-chip-remove:hover {
      opacity: 1;
    }

    /* Size: sm */
    .ui-chip.sm {
      padding: 0.125rem 0.5rem;
      font-size: 0.75rem;
    }

    /* Size: md */
    .ui-chip.md {
      padding: 0.25rem 0.75rem;
      font-size: 0.8125rem;
    }

    /* Variant: default */
    .ui-chip.default {
      background-color: #f3f4f6;
      color: #374151;
    }

    .ui-chip.default.selected,
    .ui-chip.default.clickable:hover {
      background-color: #e5e7eb;
    }

    /* Variant: primary */
    .ui-chip.primary {
      background-color: #fef3f2;
      color: var(--kengo-primary);
    }

    .ui-chip.primary.selected,
    .ui-chip.primary.clickable:hover {
      background-color: var(--kengo-primary);
      color: white;
    }

    /* Variant: success */
    .ui-chip.success {
      background-color: #ecfdf5;
      color: #059669;
    }

    .ui-chip.success.selected {
      background-color: #059669;
      color: white;
    }

    /* Variant: warning */
    .ui-chip.warning {
      background-color: #fffbeb;
      color: #d97706;
    }

    .ui-chip.warning.selected {
      background-color: #d97706;
      color: white;
    }

    /* Variant: danger */
    .ui-chip.danger {
      background-color: #fef2f2;
      color: #dc2626;
    }

    .ui-chip.danger.selected {
      background-color: #dc2626;
      color: white;
    }
  `]
})
export class ChipComponent {
  @Input() variant: ChipVariant = 'default';
  @Input() size: ChipSize = 'md';
  @Input() icon?: string;
  @Input() removable = false;
  @Input() selectable = false;
  @Input() selected = false;

  @Output() removed = new EventEmitter<void>();

  get chipClasses(): string {
    return `${this.variant} ${this.size}`;
  }

  onRemove(event: Event): void {
    event.stopPropagation();
    this.removed.emit();
  }
}
