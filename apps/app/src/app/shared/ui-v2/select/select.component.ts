import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface Ui2SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

let nextId = 0;

/**
 * Select V2 — usa nativo <select> estilizado con la estética cream.
 */
@Component({
  selector: 'ui2-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Ui2SelectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui2-select">
      @if (label()) {
        <label class="ui2-select__label" [attr.for]="selectId">{{ label() }}@if (required()) {<span class="ui2-select__required" aria-hidden="true"> *</span>}</label>
      }
      <div class="ui2-select__shell" [class.ui2-select__shell--error]="!!error()" [class.ui2-select__shell--disabled]="disabled()">
        <select
          [id]="selectId"
          [disabled]="disabled()"
          [required]="required()"
          [value]="value()"
          (change)="onChangeEvent($event)"
          (blur)="onBlur()"
        >
          @if (placeholder()) {
            <option value="" disabled>{{ placeholder() }}</option>
          }
          @for (opt of options(); track opt.value) {
            <option [value]="opt.value" [disabled]="opt.disabled">{{ opt.label }}</option>
          }
        </select>
        <span class="material-symbols-outlined ui2-select__chevron" aria-hidden="true">expand_more</span>
      </div>
      @if (error()) {
        <p class="ui2-select__msg ui2-select__msg--error">{{ error() }}</p>
      } @else if (hint()) {
        <p class="ui2-select__msg">{{ hint() }}</p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-select { display: flex; flex-direction: column; gap: 6px; }
    .ui2-select__label {
      font-family: Galvji, sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: var(--ink-700);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ui2-select__required { color: var(--danger); }
    .ui2-select__shell {
      position: relative;
      background: var(--cream-50);
      border: 1px solid var(--ink-300);
      border-radius: 14px;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .ui2-select__shell:focus-within {
      border-color: var(--kengo-primary);
      box-shadow: 0 0 0 3px rgba(231, 92, 62, 0.15);
      background: white;
    }
    .ui2-select__shell--error { border-color: var(--danger); }
    .ui2-select__shell--disabled { opacity: 0.6; }
    .ui2-select__shell select {
      width: 100%;
      padding: 12px 40px 12px 14px;
      border: 0;
      background: transparent;
      font-family: Galvji, sans-serif;
      font-size: 14px;
      color: var(--ink-900);
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
    }
    .ui2-select__chevron {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--ink-500);
      font-size: 22px;
      pointer-events: none;
    }
    .ui2-select__msg {
      font-size: 11px;
      color: var(--ink-500);
      margin: 0;
      padding: 0 4px;
    }
    .ui2-select__msg--error { color: var(--danger); font-weight: 600; }
  `],
})
export class Ui2SelectComponent implements ControlValueAccessor {
  readonly label = input<string | null>(null);
  readonly placeholder = input<string>('Seleccionar...');
  readonly options = input.required<Ui2SelectOption[]>();
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly required = input<boolean>(false);

  readonly selectId = `ui2-select-${++nextId}`;
  readonly value = signal<string | number>('');
  readonly disabled = signal<boolean>(false);

  private onChange: (value: string | number) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  onChangeEvent(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    this.value.set(v);
    this.onChange(v);
  }
  onBlur(): void { this.onTouched(); }

  writeValue(value: string | number | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string | number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
}
