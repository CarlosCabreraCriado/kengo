import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface Ui2SegmentedOption {
  id: string;
  label: string;
}

/**
 * Segmented control V2 — pill glassmorphism con N pestañas.
 * El segmento activo se resalta en coral con sombra. Resto en transparente con `--ink-500`.
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
          [attr.aria-selected]="opt.id === value() ? 'true' : 'false'"
          (click)="select(opt.id)"
        >{{ opt.label }}</button>
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
      box-shadow: 0 4px 10px -3px rgba(231, 92, 62, 0.4);
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
