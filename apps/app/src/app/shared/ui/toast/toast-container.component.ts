import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from './toast.service';

@Component({
  selector: 'ui-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ui-toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="ui-toast" [class]="getToastClasses(toast)">
          <div class="ui-toast-icon">
            <span class="material-symbols-outlined">{{ getIcon(toast.type) }}</span>
          </div>
          <div class="ui-toast-content">
            <p class="ui-toast-message">{{ toast.message }}</p>
            @if (toast.action) {
              <button
                class="ui-toast-action"
                (click)="handleAction(toast)"
              >
                {{ toast.action.label }}
              </button>
            }
          </div>
          <button
            class="ui-toast-close"
            (click)="dismiss(toast.id)"
            aria-label="Cerrar"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .ui-toast-container {
      position: fixed;
      bottom: 1rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: calc(100% - 2rem);
      max-width: 400px;
      pointer-events: none;
    }

    .ui-toast {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border-radius: 0.75rem;
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      animation: slideIn 0.2s ease-out;
      pointer-events: auto;
    }

    @keyframes slideIn {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .ui-toast-icon {
      flex-shrink: 0;
    }

    .ui-toast-icon .material-symbols-outlined {
      font-size: 1.25rem;
    }

    .ui-toast-content {
      flex: 1;
      min-width: 0;
    }

    .ui-toast-message {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .ui-toast-action {
      margin-top: 0.25rem;
      font-size: 0.8125rem;
      font-weight: 600;
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
      text-decoration: underline;
    }

    .ui-toast-close {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 0.25rem;
      background: transparent;
      border: none;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.15s;
    }

    .ui-toast-close:hover {
      opacity: 1;
    }

    .ui-toast-close .material-symbols-outlined {
      font-size: 1rem;
    }

    /* Type variants */
    .ui-toast.success {
      background-color: #ecfdf5;
      color: #065f46;
    }

    .ui-toast.success .ui-toast-action {
      color: #047857;
    }

    .ui-toast.error {
      background-color: #fef2f2;
      color: #991b1b;
    }

    .ui-toast.error .ui-toast-action {
      color: #dc2626;
    }

    .ui-toast.warning {
      background-color: #fffbeb;
      color: #92400e;
    }

    .ui-toast.warning .ui-toast-action {
      color: #d97706;
    }

    .ui-toast.info {
      background-color: #eff6ff;
      color: #1e40af;
    }

    .ui-toast.info .ui-toast-action {
      color: #2563eb;
    }
  `]
})
export class ToastContainerComponent {
  toastService = inject(ToastService);

  getToastClasses(toast: Toast): string {
    return toast.type;
  }

  getIcon(type: Toast['type']): string {
    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };
    return icons[type];
  }

  handleAction(toast: Toast): void {
    toast.action?.callback();
    this.dismiss(toast.id);
  }

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}
