import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

export type BackButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-back-button',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (route) {
      <a
        [routerLink]="route"
        [attr.aria-label]="ariaLabel"
        [class]="buttonClasses"
      >
        <span class="material-symbols-outlined" [class]="iconSizeClass">{{ icon }}</span>
      </a>
    } @else {
      <button
        type="button"
        [attr.aria-label]="ariaLabel"
        [class]="buttonClasses"
        (click)="clicked.emit($event)"
      >
        <span class="material-symbols-outlined" [class]="iconSizeClass">{{ icon }}</span>
      </button>
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
    }
  `],
})
export class BackButtonComponent {
  @Input() route?: string | unknown[];
  @Input() ariaLabel = 'Volver';
  @Input() icon = 'arrow_back';
  @Input() size: BackButtonSize = 'md';

  @Output() clicked = new EventEmitter<MouseEvent>();

  private readonly sizes: Record<BackButtonSize, string> = {
    sm: 'h-9 w-9',
    md: 'h-10 w-10',
    lg: 'h-11 w-11',
  };

  private readonly iconSizes: Record<BackButtonSize, string> = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-xl',
  };

  get buttonClasses(): string {
    return `${this.sizes[this.size]} flex shrink-0 items-center justify-center rounded-xl
            bg-white/60 backdrop-blur-md border border-white/40
            text-zinc-600 shadow-sm transition-all duration-200
            hover:bg-white/80 hover:scale-105 active:scale-95
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kengo-primary/30`;
  }

  get iconSizeClass(): string {
    return this.iconSizes[this.size];
  }
}
