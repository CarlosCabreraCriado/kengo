import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type Ui2ProgressBarSize = 'sm' | 'md';
export type Ui2ProgressBarMode = 'determinate' | 'indeterminate';
export type Ui2ProgressBarColor = 'primary' | 'success' | 'warning' | 'danger';

/**
 * Progress bar lineal V2. Coral por defecto, track ink-100. Variantes `sm`/`md`.
 */
@Component({
  selector: 'ui2-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="ui2-pb"
      [class]="rootClass()"
      role="progressbar"
      [attr.aria-valuenow]="mode() === 'determinate' ? clampedValue() : null"
      [attr.aria-valuemin]="0"
      [attr.aria-valuemax]="100"
    >
      <div class="ui2-pb__fill" [style.width.%]="fillWidth()"></div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-pb {
      width: 100%;
      overflow: hidden;
      position: relative;
      background: var(--ink-100);
      border-radius: 9999px;
    }
    .ui2-pb--sm { height: 4px; }
    .ui2-pb--md { height: 8px; }

    .ui2-pb__fill {
      height: 100%;
      border-radius: 9999px;
      transition: width 0.3s ease;
      background: linear-gradient(90deg, var(--kengo-primary-light), var(--kengo-primary));
    }
    .ui2-pb--success .ui2-pb__fill { background: var(--success); }
    .ui2-pb--warning .ui2-pb__fill { background: var(--warning); }
    .ui2-pb--danger .ui2-pb__fill { background: var(--danger); }

    .ui2-pb--indeterminate .ui2-pb__fill {
      width: 40% !important;
      animation: ui2-pb-indeterminate 1.4s ease-in-out infinite;
    }
    @keyframes ui2-pb-indeterminate {
      0% { transform: translateX(-110%); }
      100% { transform: translateX(260%); }
    }
  `],
})
export class Ui2ProgressBarComponent {
  readonly value = input<number>(0);
  readonly size = input<Ui2ProgressBarSize>('md');
  readonly mode = input<Ui2ProgressBarMode>('determinate');
  readonly color = input<Ui2ProgressBarColor>('primary');

  readonly clampedValue = computed(() => Math.min(100, Math.max(0, this.value())));

  readonly fillWidth = computed(() =>
    this.mode() === 'indeterminate' ? 40 : this.clampedValue(),
  );

  readonly rootClass = computed(() => {
    const cls = ['ui2-pb', `ui2-pb--${this.size()}`, `ui2-pb--${this.color()}`];
    if (this.mode() === 'indeterminate') cls.push('ui2-pb--indeterminate');
    return cls.join(' ');
  });
}
