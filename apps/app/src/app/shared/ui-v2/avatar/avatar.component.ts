import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type Ui2AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type Ui2AvatarGradient =
  | 'indigo'
  | 'coral'
  | 'amber'
  | 'green';

const SIZE_PX: Record<Ui2AvatarSize, number> = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 56,
  xl: 72,
};

const GRADIENTS: Record<Ui2AvatarGradient, string> = {
  indigo: 'linear-gradient(135deg, #6366f1, #4338ca)',
  coral: 'linear-gradient(135deg, var(--kengo-primary), var(--kengo-primary-dark))',
  amber: 'linear-gradient(135deg, #f59e0b, var(--kengo-primary))',
  green: 'linear-gradient(135deg, #34d399, #059669)',
};

/**
 * Avatar circular V2 — soporta imagen o inicial sobre gradient.
 * Acepta `online` (dot verde) y `border` (borde blanco con sombra).
 */
@Component({
  selector: 'ui2-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ui2-avatar" [style.width.px]="px()" [style.height.px]="px()">
      <span
        class="ui2-avatar__inner"
        [style.background]="src() ? 'transparent' : gradientCss()"
        [style.font-size.px]="fontSizePx()"
        [class.ui2-avatar__inner--bordered]="border()"
        [class.ui2-avatar__inner--active]="active()"
      >
        @if (src()) {
          <img [src]="src()!" [alt]="name()" class="ui2-avatar__img" />
        } @else {
          {{ initial() }}
        }
      </span>
      @if (online()) {
        <span
          class="ui2-avatar__dot"
          [style.width.px]="dotPx()"
          [style.height.px]="dotPx()"
        ></span>
      }
    </span>
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }
    .ui2-avatar {
      position: relative;
      display: inline-flex;
      flex-shrink: 0;
    }
    .ui2-avatar__inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      color: white;
      font-family: KengoDisplay, kengoFont, sans-serif;
      display: grid;
      place-items: center;
      overflow: hidden;
      line-height: 1;
    }
    .ui2-avatar__inner--bordered {
      border: 2.5px solid white;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
    }
    .ui2-avatar__inner--active {
      box-shadow:
        0 0 0 2px var(--kengo-primary),
        0 6px 16px rgba(var(--kengo-primary-rgb), 0.35);
    }
    .ui2-avatar__inner--bordered.ui2-avatar__inner--active {
      box-shadow:
        0 0 0 2px var(--kengo-primary),
        0 6px 16px rgba(var(--kengo-primary-rgb), 0.35);
    }
    .ui2-avatar__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .ui2-avatar__dot {
      position: absolute;
      bottom: 0;
      right: 0;
      border-radius: 50%;
      background: var(--success);
      border: 2.5px solid white;
    }
  `],
})
export class Ui2AvatarComponent {
  readonly name = input<string>('');
  readonly src = input<string | null>(null);
  readonly size = input<Ui2AvatarSize>('md');
  readonly gradient = input<Ui2AvatarGradient>('indigo');
  readonly border = input<boolean>(false);
  readonly online = input<boolean>(false);
  readonly active = input<boolean>(false);

  readonly px = computed(() => SIZE_PX[this.size()]);
  readonly dotPx = computed(() => Math.round(this.px() * 0.28));
  readonly fontSizePx = computed(() => Math.round(this.px() * 0.42));
  readonly gradientCss = computed(() => GRADIENTS[this.gradient()]);

  readonly initial = computed(() => {
    const n = this.name().trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
    return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
  });
}
