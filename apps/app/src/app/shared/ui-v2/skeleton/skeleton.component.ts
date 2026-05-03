import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type Ui2SkeletonVariant = 'line' | 'circle' | 'block' | 'pill';

const DEFAULT_RADIUS: Record<Ui2SkeletonVariant, string> = {
  line: '8px',
  circle: '9999px',
  block: '22px',
  pill: '9999px',
};

const DEFAULT_HEIGHT: Record<Ui2SkeletonVariant, string> = {
  line: '12px',
  circle: '40px',
  block: '120px',
  pill: '20px',
};

const DEFAULT_WIDTH: Record<Ui2SkeletonVariant, string> = {
  line: '100%',
  circle: '40px',
  block: '100%',
  pill: '64px',
};

/**
 * Placeholder shimmer V2 — usar para datos secundarios mientras llegan,
 * preservando la altura del layout y evitando reflow al rellenar.
 *
 * Variantes:
 * - `line`: línea horizontal de texto.
 * - `circle`: avatar/icono redondo.
 * - `block`: tarjeta o área grande (radius 22 px).
 * - `pill`: badge/chip pequeño.
 *
 * Props opcionales `width`, `height` y `radius` para sobrescribir los
 * defaults por variant.
 */
@Component({
  selector: 'ui2-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="ui2-skeleton"
      [style.width]="resolvedWidth()"
      [style.height]="resolvedHeight()"
      [style.border-radius]="resolvedRadius()"
      aria-hidden="true"
    ></span>
  `,
  styles: [`
    :host {
      display: inline-block;
      line-height: 0;
    }
    .ui2-skeleton {
      display: inline-block;
      background-color: var(--ink-100, rgba(0, 0, 0, 0.06));
      background-image: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.55) 50%,
        transparent 100%
      );
      background-size: 200% 100%;
      background-repeat: no-repeat;
      background-position: -100% 0;
      animation: ui2-skeleton-shimmer 1.4s ease-in-out infinite;
    }
    @keyframes ui2-skeleton-shimmer {
      0% { background-position: -100% 0; }
      100% { background-position: 200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ui2-skeleton {
        animation: ui2-skeleton-pulse 1.6s ease-in-out infinite;
        background-image: none;
      }
      @keyframes ui2-skeleton-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
    }
  `],
})
export class Ui2SkeletonComponent {
  readonly variant = input<Ui2SkeletonVariant>('line');
  readonly width = input<string | null>(null);
  readonly height = input<string | null>(null);
  readonly radius = input<string | null>(null);

  protected readonly resolvedWidth = computed(() => this.width() ?? DEFAULT_WIDTH[this.variant()]);
  protected readonly resolvedHeight = computed(() => this.height() ?? DEFAULT_HEIGHT[this.variant()]);
  protected readonly resolvedRadius = computed(() => this.radius() ?? DEFAULT_RADIUS[this.variant()]);
}
