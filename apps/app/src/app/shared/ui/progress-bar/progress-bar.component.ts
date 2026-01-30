import { Component, Input } from '@angular/core';

export type ProgressBarMode = 'determinate' | 'indeterminate';
export type ProgressBarColor = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'ui-progress-bar',
  standalone: true,
  imports: [],
  template: `
    <div class="ui-progress-bar" [class]="containerClasses" role="progressbar"
         [attr.aria-valuenow]="mode === 'determinate' ? value : null"
         [attr.aria-valuemin]="0"
         [attr.aria-valuemax]="100">
      <div class="ui-progress-bar-fill" [class]="fillClasses" [style.width]="fillWidth"></div>
    </div>
  `,
  styles: [`
    .ui-progress-bar {
      width: 100%;
      overflow: hidden;
      position: relative;
    }

    .ui-progress-bar-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    .ui-progress-bar.indeterminate .ui-progress-bar-fill {
      width: 50% !important;
      animation: indeterminate 1.5s infinite linear;
    }

    @keyframes indeterminate {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(300%);
      }
    }
  `]
})
export class ProgressBarComponent {
  @Input() value = 0;
  @Input() mode: ProgressBarMode = 'determinate';
  @Input() color: ProgressBarColor = 'primary';
  @Input() height: 'sm' | 'md' | 'lg' = 'md';
  @Input() rounded = true;

  get containerClasses(): string {
    const heights = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3'
    };

    const backgrounds = {
      primary: 'bg-primary/20',
      secondary: 'bg-gray-200',
      success: 'bg-green-100',
      warning: 'bg-yellow-100',
      danger: 'bg-red-100'
    };

    const roundedClass = this.rounded ? 'rounded-full' : '';

    return `${heights[this.height]} ${backgrounds[this.color]} ${roundedClass} ${this.mode}`;
  }

  get fillClasses(): string {
    const colors = {
      primary: 'bg-primary',
      secondary: 'bg-gray-600',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      danger: 'bg-red-500'
    };

    const roundedClass = this.rounded ? 'rounded-full' : '';

    return `${colors[this.color]} ${roundedClass}`;
  }

  get fillWidth(): string {
    if (this.mode === 'indeterminate') {
      return '50%';
    }
    const clampedValue = Math.min(100, Math.max(0, this.value));
    return `${clampedValue}%`;
  }
}
