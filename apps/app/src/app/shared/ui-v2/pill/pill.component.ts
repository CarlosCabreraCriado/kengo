import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type Ui2PillVariant = 'primary' | 'soft' | 'neutral' | 'success' | 'warning' | 'danger' | 'custom';
export type Ui2PillSize = 'sm' | 'md';

interface VariantSpec {
  bg: string;
  fg: string;
  shadow: string;
}

const VARIANTS: Record<Exclude<Ui2PillVariant, 'custom'>, VariantSpec> = {
  primary: {
    bg: 'var(--kengo-primary)',
    fg: 'white',
    shadow: 'var(--shadow-pill-coral)',
  },
  soft: {
    bg: 'rgba(var(--kengo-primary-rgb), 0.1)',
    fg: 'var(--kengo-primary)',
    shadow: 'none',
  },
  neutral: {
    bg: 'rgba(0, 0, 0, 0.04)',
    fg: 'var(--ink-700)',
    shadow: 'none',
  },
  success: {
    bg: 'rgba(34, 197, 94, 0.12)',
    fg: 'var(--success)',
    shadow: 'none',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.14)',
    fg: 'var(--warning)',
    shadow: 'none',
  },
  danger: {
    bg: 'rgba(239, 68, 68, 0.12)',
    fg: 'var(--danger)',
    shadow: 'none',
  },
};

/**
 * Pill V2 — chip redondeado para tags, badges y CTAs pequeñas.
 */
@Component({
  selector: 'ui2-pill',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Un único <ng-content>: Angular solo proyecta el contenido en un slot,
         así que duplicarlo en las dos ramas del @if deja vacía a una de ellas
         (el <button> salía sin texto). El outlet lo reutiliza en ambas. -->
    <ng-template #cuerpo>
      @if (icon()) {
        <span
          class="material-symbols-outlined ui2-pill__icon"
          aria-hidden="true"
        >{{ icon() }}</span>
      }
      <ng-content></ng-content>
    </ng-template>

    @if (clickable()) {
      <button
        type="button"
        class="ui2-pill ui2-pill--clickable"
        [class.ui2-pill--md]="size() === 'md'"
        [style.background]="spec().bg"
        [style.color]="spec().fg"
        [style.box-shadow]="spec().shadow"
        (click)="onClick($event)"
      >
        <ng-container [ngTemplateOutlet]="cuerpo"></ng-container>
      </button>
    } @else {
      <span
        class="ui2-pill"
        [class.ui2-pill--md]="size() === 'md'"
        [style.background]="spec().bg"
        [style.color]="spec().fg"
        [style.box-shadow]="spec().shadow"
      >
        <ng-container [ngTemplateOutlet]="cuerpo"></ng-container>
      </span>
    }
  `,
  styles: [`
    :host { display: inline-flex; max-width: 100%; min-width: 0; }
    .ui2-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.1px;
      max-width: 100%;
      min-width: 0;
    }
    .ui2-pill--md {
      gap: 6px;
      padding: 8px 14px;
      font-size: 12px;
    }
    .ui2-pill--clickable {
      cursor: pointer;
      transition: transform 0.12s ease, opacity 0.12s ease;
    }
    .ui2-pill--clickable:active {
      transform: scale(0.95);
      opacity: 0.85;
    }
    @media (prefers-reduced-motion: reduce) {
      .ui2-pill--clickable,
      .ui2-pill--clickable:active { transition: none; transform: none; }
    }
    .ui2-pill__icon {
      flex: 0 0 auto;
      font-size: 12px;
      line-height: 1;
    }
    .ui2-pill--md .ui2-pill__icon { font-size: 14px; }
  `],
})
export class Ui2PillComponent {
  readonly variant = input<Ui2PillVariant>('soft');
  readonly size = input<Ui2PillSize>('sm');
  readonly icon = input<string | null>(null);
  readonly color = input<string | null>(null);
  readonly clickable = input<boolean>(false);
  readonly pillClick = output<MouseEvent>();

  readonly spec = computed<VariantSpec>(() => {
    const v = this.variant();
    if (v === 'custom') {
      const c = this.color() ?? 'var(--ink-700)';
      return {
        bg: c.startsWith('var(') ? `color-mix(in srgb, ${c} 12%, transparent)` : `${c}1f`,
        fg: c,
        shadow: 'none',
      };
    }
    return VARIANTS[v];
  });

  onClick(event: MouseEvent): void {
    this.pillClick.emit(event);
  }
}
