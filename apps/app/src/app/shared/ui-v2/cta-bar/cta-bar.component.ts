import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type Ui2CtaBarVariant = 'primary' | 'secondary';

/**
 * CTA bar V2 — banner full-width con icon-circle a la izquierda + título KengoDisplay + subtítulo + arrow.
 *  - `primary`: gradiente coral, texto blanco, sombra coral.
 *  - `secondary`: blanco, texto ink, icono coral con sombra.
 */
@Component({
  selector: 'ui2-cta-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="ui2-cta"
      [class.ui2-cta--primary]="variant() === 'primary'"
      [class.ui2-cta--secondary]="variant() === 'secondary'"
      [disabled]="disabled()"
      (click)="clicked.emit($event)"
    >
      <span class="ui2-cta__icon-circle">
        <span class="material-symbols-outlined" aria-hidden="true">{{ icon() }}</span>
      </span>
      <span class="ui2-cta__text">
        <span class="ui2-cta__title">{{ title() }}</span>
        @if (subtitle()) {
          <span class="ui2-cta__subtitle">{{ subtitle() }}</span>
        }
      </span>
      <span class="material-symbols-outlined ui2-cta__arrow" aria-hidden="true">{{ trailingIcon() }}</span>
    </button>
  `,
  styles: [`
    :host { display: block; }
    .ui2-cta {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px;
      border: 0;
      border-radius: 22px;
      cursor: pointer;
      text-align: left;
      font: inherit;
      color: inherit;
      transition: transform 0.1s, filter 0.2s, box-shadow 0.2s;
    }
    .ui2-cta:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .ui2-cta:active:not(:disabled) { transform: translateY(1px); }
    .ui2-cta:hover:not(:disabled) { filter: brightness(1.04); }

    .ui2-cta--primary {
      background: linear-gradient(135deg, var(--kengo-primary), var(--kengo-primary-dark));
      color: white;
      box-shadow: var(--shadow-cta-coral);
    }
    .ui2-cta--secondary {
      background: white;
      color: var(--ink-900);
      box-shadow: var(--shadow-card);
    }

    .ui2-cta__icon-circle {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .ui2-cta--primary .ui2-cta__icon-circle {
      background: rgba(255, 255, 255, 0.22);
    }
    .ui2-cta--secondary .ui2-cta__icon-circle {
      background: linear-gradient(135deg, var(--kengo-primary), var(--kengo-primary-dark));
      box-shadow: 0 6px 14px -3px rgba(var(--kengo-primary-rgb), 0.5);
    }
    .ui2-cta__icon-circle .material-symbols-outlined {
      font-size: 26px;
      color: white;
    }

    .ui2-cta__text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .ui2-cta__title {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 20px;
      line-height: 1;
      letter-spacing: 0.3px;
    }
    .ui2-cta__subtitle {
      font-size: 12px;
      margin-top: 4px;
    }
    .ui2-cta--primary .ui2-cta__subtitle { opacity: 0.9; color: white; }
    .ui2-cta--secondary .ui2-cta__subtitle { color: var(--ink-500); }

    .ui2-cta__arrow {
      font-size: 22px;
    }
    .ui2-cta--secondary .ui2-cta__arrow { color: var(--kengo-primary); }
  `],
})
export class Ui2CtaBarComponent {
  readonly icon = input<string>('play_arrow');
  readonly trailingIcon = input<string>('arrow_forward');
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly variant = input<Ui2CtaBarVariant>('primary');
  readonly disabled = input<boolean>(false);
  readonly clicked = output<MouseEvent>();
}
