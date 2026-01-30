import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'ui-dialog-header',
  standalone: true,
  imports: [],
  template: `
    <div class="ui-dialog-header">
      <div class="flex-1 min-w-0">
        @if (title) {
          <h2 class="text-lg font-semibold text-gray-900 truncate">{{ title }}</h2>
        }
        @if (subtitle) {
          <p class="text-sm text-gray-500 mt-0.5 truncate">{{ subtitle }}</p>
        }
        <ng-content></ng-content>
      </div>

      @if (showClose) {
        <button
          type="button"
          class="ui-dialog-close"
          (click)="closeClick.emit()"
          aria-label="Cerrar"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
      }
    </div>
  `,
  styles: [`
    .ui-dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #f3f4f6;
    }

    .ui-dialog-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 0.5rem;
      color: #6b7280;
      transition: all 0.15s;
      border: none;
      background: transparent;
      cursor: pointer;
      flex-shrink: 0;
    }

    .ui-dialog-close:hover {
      background-color: #f3f4f6;
      color: #374151;
    }

    .ui-dialog-close .material-symbols-outlined {
      font-size: 1.25rem;
    }
  `]
})
export class DialogHeaderComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() showClose = true;

  @Output() closeClick = new EventEmitter<void>();
}
