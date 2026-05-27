import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

export type Ui2InactivityBannerVariant = 'warn' | 'danger' | 'info';

interface VariantSpec {
  bg: string;
  border: string;
  fg: string;
  iconBg: string;
  iconFg: string;
}

const VARIANTS: Record<Ui2InactivityBannerVariant, VariantSpec> = {
  warn: {
    bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.04))',
    border: 'rgba(251, 191, 36, 0.45)',
    fg: '#92400e',
    iconBg: 'rgba(255, 255, 255, 0.7)',
    iconFg: '#a16207',
  },
  danger: {
    bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(239, 68, 68, 0.04))',
    border: 'rgba(239, 68, 68, 0.4)',
    fg: '#b91c1c',
    iconBg: 'rgba(255, 255, 255, 0.7)',
    iconFg: '#b91c1c',
  },
  info: {
    bg: 'linear-gradient(135deg, rgba(var(--kengo-primary-rgb), 0.16), rgba(var(--kengo-primary-rgb), 0.04))',
    border: 'rgba(var(--kengo-primary-rgb), 0.35)',
    fg: 'var(--kengo-primary-dark)',
    iconBg: 'rgba(255, 255, 255, 0.7)',
    iconFg: 'var(--kengo-primary)',
  },
};

/**
 * Banner inline V2 — alerta dentro del flujo de la página (no fixed-top).
 */
@Component({
  selector: 'ui2-inactivity-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="ui2-iab"
      role="status"
      [style.background]="spec().bg"
      [style.border-color]="spec().border"
      [style.color]="spec().fg"
    >
      <span
        class="ui2-iab__icon"
        [style.background]="spec().iconBg"
        [style.color]="spec().iconFg"
        aria-hidden="true"
      >
        <span class="material-symbols-outlined">{{ icon() }}</span>
      </span>
      <div class="ui2-iab__text">
        <span class="ui2-iab__title">{{ title() }}</span>
        <span class="ui2-iab__body">{{ body() }}</span>
      </div>
      @if (actionLabel()) {
        <button
          type="button"
          class="ui2-iab__action"
          [style.color]="spec().fg"
          [style.border-color]="spec().border"
          (click)="actionClick.emit()"
        >
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .ui2-iab {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        border: 1px solid;
        border-radius: 16px;
      }
      .ui2-iab__icon {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border-radius: 12px;
        display: grid;
        place-items: center;
      }
      .ui2-iab__icon .material-symbols-outlined {
        font-size: 20px;
      }
      .ui2-iab__text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .ui2-iab__title {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        line-height: 1.1;
      }
      .ui2-iab__body {
        font-size: 12px;
        line-height: 1.4;
        opacity: 0.85;
      }
      .ui2-iab__action {
        flex-shrink: 0;
        padding: 8px 14px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid;
        font-size: 12px;
        font-weight: 700;
        font-family: Galvji, sans-serif;
        cursor: pointer;
        white-space: nowrap;
      }
      .ui2-iab__action:hover {
        background: rgba(255, 255, 255, 0.9);
      }
      @media (max-width: 480px) {
        .ui2-iab {
          flex-wrap: wrap;
        }
        .ui2-iab__action {
          margin-left: 50px;
        }
      }
    `,
  ],
})
export class Ui2InactivityBannerComponent {
  readonly title = input.required<string>();
  readonly body = input<string>('');
  readonly icon = input<string>('notifications');
  readonly actionLabel = input<string | null>(null);
  readonly variant = input<Ui2InactivityBannerVariant>('warn');
  readonly actionClick = output<void>();

  readonly spec = computed<VariantSpec>(() => VARIANTS[this.variant()]);
}
