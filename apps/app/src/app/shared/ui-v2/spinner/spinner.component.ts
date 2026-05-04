import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
type SpinnerColor = 'primary' | 'white' | 'ink';

const SIZE_PX: Record<SpinnerSize, number> = { sm: 16, md: 24, lg: 32, xl: 48 };

const COLORS: Record<SpinnerColor, string> = {
  primary: 'var(--kengo-primary)',
  white: 'white',
  ink: 'var(--ink-500)',
};

/**
 * Spinner V2 — círculo animado con stroke configurable.
 */
@Component({
  selector: 'ui2-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ui2-spinner-wrap">
      <span
        class="ui2-spinner"
        [style.width.px]="px()"
        [style.height.px]="px()"
        [style.border-color]="track()"
        [style.border-top-color]="strokeColor()"
        [style.border-width.px]="borderPx()"
      ></span>
      @if (label()) {
        <span class="ui2-spinner__label">{{ label() }}</span>
      }
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    .ui2-spinner-wrap {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .ui2-spinner {
      display: inline-block;
      border-style: solid;
      border-radius: 50%;
      animation: ui2-spinner-spin 0.6s linear infinite;
      flex-shrink: 0;
    }
    .ui2-spinner__label {
      font-size: 13px;
      color: var(--ink-700);
    }
    @keyframes ui2-spinner-spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class Ui2SpinnerComponent {
  readonly size = input<SpinnerSize>('md');
  readonly color = input<SpinnerColor>('primary');
  readonly label = input<string | null>(null);

  readonly px = computed(() => SIZE_PX[this.size()]);
  readonly borderPx = computed(() => Math.max(2, Math.round(this.px() / 12)));
  readonly strokeColor = computed(() => COLORS[this.color()]);
  readonly track = computed(() => {
    const c = this.color();
    if (c === 'primary') return 'rgba(var(--kengo-primary-rgb), 0.18)';
    if (c === 'white') return 'rgba(255, 255, 255, 0.25)';
    return 'rgba(107, 114, 128, 0.2)';
  });
}
