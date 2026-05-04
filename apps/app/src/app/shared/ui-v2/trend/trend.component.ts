import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type Ui2TrendSize = 'sm' | 'md';

/**
 * Indicador inline de tendencia ▲/▼ con signo y color semántico.
 * - `inverse=true` invierte la semántica: valores negativos = mejora (útil para dolor).
 * - El color se calcula a partir del valor + flag inverse:
 *   verde si mejora, rojo si empeora, gris si no hay cambio (o `value` es nulo).
 */
@Component({
  selector: 'ui2-trend',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (value() !== null) {
      <span class="ui2-trend" [class.ui2-trend--md]="size() === 'md'" [style.color]="color()">
        <span class="material-symbols-outlined ui2-trend__icon" aria-hidden="true">{{ icon() }}</span>
        <span>{{ formatted() }}</span>
      </span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .ui2-trend {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0.1px;
      }
      .ui2-trend--md {
        font-size: 12px;
        gap: 4px;
      }
      .ui2-trend__icon {
        font-size: 14px;
        line-height: 1;
      }
      .ui2-trend--md .ui2-trend__icon {
        font-size: 16px;
      }
    `,
  ],
})
export class Ui2TrendComponent {
  readonly value = input<number | null>(null);
  readonly suffix = input<string>('');
  readonly inverse = input<boolean>(false);
  readonly size = input<Ui2TrendSize>('sm');
  readonly decimals = input<number>(0);

  readonly direction = computed<'up' | 'down' | 'flat'>(() => {
    const v = this.value();
    if (v == null || v === 0) return 'flat';
    return v > 0 ? 'up' : 'down';
  });

  readonly icon = computed<string>(() => {
    const d = this.direction();
    if (d === 'flat') return 'remove';
    return d === 'up' ? 'trending_up' : 'trending_down';
  });

  readonly color = computed<string>(() => {
    const d = this.direction();
    if (d === 'flat') return 'var(--ink-400)';
    const isImproving = this.inverse() ? d === 'down' : d === 'up';
    return isImproving ? 'var(--success)' : 'var(--danger)';
  });

  readonly formatted = computed<string>(() => {
    const v = this.value();
    if (v == null) return '';
    const abs = Math.abs(v);
    const fixed = this.decimals() > 0 ? abs.toFixed(this.decimals()) : Math.round(abs).toString();
    const sign = v > 0 ? '+' : v < 0 ? '−' : '';
    return `${sign}${fixed}${this.suffix()}`;
  });
}
