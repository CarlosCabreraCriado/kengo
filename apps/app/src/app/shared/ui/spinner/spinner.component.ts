import { Component, Input } from '@angular/core';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'primary' | 'white' | 'gray';

@Component({
  selector: 'ui-spinner',
  standalone: true,
  imports: [],
  template: `
    <div [class]="spinnerClasses" role="status" aria-label="Cargando">
      <svg class="animate-spin" viewBox="0 0 24 24" fill="none">
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      @if (label) {
        <span class="ml-2">{{ label }}</span>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }
  `]
})
export class SpinnerComponent {
  @Input() size: SpinnerSize = 'md';
  @Input() color: SpinnerColor = 'primary';
  @Input() label?: string;

  get spinnerClasses(): string {
    const sizes = {
      sm: '[&>svg]:w-4 [&>svg]:h-4 text-sm',
      md: '[&>svg]:w-6 [&>svg]:h-6 text-base',
      lg: '[&>svg]:w-8 [&>svg]:h-8 text-lg',
      xl: '[&>svg]:w-12 [&>svg]:h-12 text-xl'
    };

    const colors = {
      primary: 'text-primary',
      white: 'text-white',
      gray: 'text-gray-500'
    };

    return `inline-flex items-center ${sizes[this.size]} ${colors[this.color]}`;
  }
}
