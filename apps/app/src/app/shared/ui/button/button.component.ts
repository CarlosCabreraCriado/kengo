import { Component, Input, Output, EventEmitter, HostBinding } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-button',
  standalone: true,
  imports: [],
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [class]="buttonClasses"
      (click)="handleClick($event)"
    >
      @if (loading) {
        <span class="ui-button-spinner"></span>
      }
      @if (iconLeft && !loading) {
        <span class="material-symbols-outlined text-[1.25em]">{{ iconLeft }}</span>
      }
      <span class="ui-button-content" [class.opacity-0]="loading && !iconOnly">
        <ng-content></ng-content>
      </span>
      @if (iconRight && !loading) {
        <span class="material-symbols-outlined text-[1.25em]">{{ iconRight }}</span>
      }
    </button>
  `,
  styles: [`
    :host {
      display: inline-block;
    }

    :host(.full-width) {
      display: block;
      width: 100%;
    }

    :host(.full-width) button {
      width: 100%;
    }

    .ui-button-spinner {
      position: absolute;
      width: 1.25em;
      height: 1.25em;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .ui-button-content {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
  `]
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() iconLeft?: string;
  @Input() iconRight?: string;
  @Input() iconOnly = false;
  @Input() fullWidth = false;

  @Output() clicked = new EventEmitter<MouseEvent>();

  @HostBinding('class.full-width')
  get isFullWidth() {
    return this.fullWidth;
  }

  get buttonClasses(): string {
    const base = 'relative inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants: Record<ButtonVariant, string> = {
      primary: 'bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500',
      outline: 'border-2 border-primary text-primary hover:bg-primary/10 focus-visible:ring-primary',
      ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
    };

    const sizes: Record<ButtonSize, string> = {
      sm: this.iconOnly ? 'p-1.5 text-sm rounded-lg' : 'px-3 py-1.5 text-sm rounded-lg',
      md: this.iconOnly ? 'p-2 text-base rounded-xl' : 'px-4 py-2 text-base rounded-xl',
      lg: this.iconOnly ? 'p-3 text-lg rounded-2xl' : 'px-6 py-3 text-lg rounded-2xl',
    };

    return `${base} ${variants[this.variant]} ${sizes[this.size]}`;
  }

  handleClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }
}
