import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface Ui2RadioOption {
  value: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
}

let nextGroup = 0;

/**
 * Radio group V2 — mismo lenguaje que checkbox; opciones en cards verticales/horizontales.
 */
@Component({
  selector: 'ui2-radio-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Ui2RadioGroupComponent),
      multi: true,
    },
  ],
  template: `
    <fieldset class="ui2-radio-group" [disabled]="disabled()">
      @if (label()) {
        <legend class="ui2-radio-group__legend">{{ label() }}</legend>
      }
      <div class="ui2-radio-group__list" [class.ui2-radio-group__list--horizontal]="orientation() === 'horizontal'">
        @for (opt of options(); track opt.value) {
          <label
            class="ui2-radio"
            [class.ui2-radio--checked]="value() === opt.value"
            [class.ui2-radio--disabled]="opt.disabled"
          >
            <input
              type="radio"
              [name]="groupName"
              [value]="opt.value"
              [checked]="value() === opt.value"
              [disabled]="opt.disabled || disabled()"
              (change)="select(opt.value)"
            />
            <span class="ui2-radio__circle"><span class="ui2-radio__dot"></span></span>
            <span class="ui2-radio__text">
              <span class="ui2-radio__label">{{ opt.label }}</span>
              @if (opt.description) {
                <span class="ui2-radio__desc">{{ opt.description }}</span>
              }
            </span>
          </label>
        }
      </div>
      @if (error()) {
        <p class="ui2-radio-group__msg">{{ error() }}</p>
      }
    </fieldset>
  `,
  styles: [`
    :host { display: block; }
    .ui2-radio-group { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
    .ui2-radio-group__legend {
      font-family: Galvji, sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: var(--ink-700);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 0;
      margin-bottom: 4px;
    }
    .ui2-radio-group__list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ui2-radio-group__list--horizontal {
      flex-direction: row;
      flex-wrap: wrap;
    }
    .ui2-radio {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      background: var(--cream-50);
      border: 1px solid var(--ink-300);
      border-radius: 14px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .ui2-radio:hover { border-color: var(--kengo-primary); }
    .ui2-radio--checked {
      border-color: var(--kengo-primary);
      background: white;
      box-shadow: 0 0 0 3px rgba(231, 92, 62, 0.12);
    }
    .ui2-radio--disabled { opacity: 0.5; cursor: not-allowed; }
    .ui2-radio input { position: absolute; opacity: 0; pointer-events: none; }
    .ui2-radio__circle {
      width: 18px; height: 18px;
      border-radius: 50%;
      border: 1.5px solid var(--ink-300);
      display: inline-grid; place-items: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .ui2-radio--checked .ui2-radio__circle { border-color: var(--kengo-primary); }
    .ui2-radio__dot {
      width: 9px; height: 9px;
      border-radius: 50%;
      background: transparent;
      transition: background 0.15s;
    }
    .ui2-radio--checked .ui2-radio__dot { background: var(--kengo-primary); }
    .ui2-radio__text { display: flex; flex-direction: column; gap: 2px; }
    .ui2-radio__label { font-size: 14px; font-weight: 600; color: var(--ink-900); }
    .ui2-radio__desc { font-size: 12px; color: var(--ink-500); }
    .ui2-radio-group__msg {
      font-size: 11px;
      color: var(--danger);
      font-weight: 600;
      margin: 0;
      padding: 0 4px;
    }
  `],
})
export class Ui2RadioGroupComponent implements ControlValueAccessor {
  readonly label = input<string | null>(null);
  readonly options = input.required<Ui2RadioOption[]>();
  readonly error = input<string | null>(null);
  readonly orientation = input<'vertical' | 'horizontal'>('vertical');

  readonly groupName = `ui2-radio-${++nextGroup}`;
  readonly value = signal<string | number | null>(null);
  readonly disabled = signal<boolean>(false);

  private onChange: (value: string | number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  select(v: string | number): void {
    if (this.disabled()) return;
    this.value.set(v);
    this.onChange(v);
    this.onTouched();
  }

  writeValue(value: string | number | null): void { this.value.set(value); }
  registerOnChange(fn: (value: string | number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
}
