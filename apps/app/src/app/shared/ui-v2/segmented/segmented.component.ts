import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface Ui2SegmentedOption {
  id: string;
  label: string;
  icon?: string;
}

/**
 * Segmented control V2 — pill glassmorphism con N pestañas.
 * El segmento activo se resalta en coral con sombra. Resto en transparente con `--ink-500`.
 * Si `opt.icon` está presente, se renderiza el icono (Material Symbol) y `label` se usa como aria-label.
 */
@Component({
  selector: 'ui2-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-seg" role="tablist">
      @for (opt of options(); track opt.id) {
        <button
          type="button"
          role="tab"
          class="ui2-seg__item"
          [class.ui2-seg__item--active]="opt.id === value()"
          [class.ui2-seg__item--icon]="!!opt.icon"
          [attr.aria-selected]="opt.id === value() ? 'true' : 'false'"
          [attr.aria-label]="opt.icon ? opt.label : null"
          [attr.title]="opt.icon ? opt.label : null"
          (click)="select(opt.id)"
        >
          @if (opt.icon) {
            <span class="material-symbols-outlined ui2-seg__icon" aria-hidden="true">{{ opt.icon }}</span>
          } @else {
            {{ opt.label }}
          }
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-seg {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.9);
      border-radius: 9999px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    .ui2-seg__item {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      padding: 8px 0;
      border-radius: 9999px;
      background: transparent;
      color: var(--ink-500);
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    }
    .ui2-seg__item--active {
      background: var(--kengo-primary);
      color: white;
      box-shadow: 0 4px 10px -3px rgba(var(--kengo-primary-rgb), 0.4);
    }
    .ui2-seg__item--icon {
      padding: 8px 18px;
    }
    .ui2-seg__icon {
      font-size: 20px;
      line-height: 1;
    }
  `],
})
export class Ui2SegmentedComponent {
  readonly options = input.required<Ui2SegmentedOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();

  select(id: string): void {
    if (id !== this.value()) this.valueChange.emit(id);
  }
}
