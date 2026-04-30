import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type Ui2DatepickerMode = 'date' | 'datetime' | 'time';

let nextId = 0;

/**
 * Datepicker V2 — wrap mobile-first del input nativo HTML5 (`type="date|datetime-local|time"`).
 * Surface cream + border ink + focus coral, alineado con `Ui2InputComponent`.
 *
 * Soporta dos modos de uso intercambiables:
 *  - **Reactive Forms / ngModel**: usar `formControlName` o `[ngModel]`.
 *  - **Imperativo**: usar `[value]` + `(valueChange)` directamente sin form.
 */
@Component({
  selector: 'ui2-datepicker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Ui2DatepickerComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui2-dp">
      @if (label()) {
        <label class="ui2-dp__label" [attr.for]="inputId">
          {{ label() }}@if (required()) {<span class="ui2-dp__required" aria-hidden="true"> *</span>}
        </label>
      }
      <div
        class="ui2-dp__shell"
        [class.ui2-dp__shell--error]="!!error()"
        [class.ui2-dp__shell--disabled]="disabled()"
      >
        <span class="material-symbols-outlined ui2-dp__icon" aria-hidden="true">{{ leadingIcon() }}</span>
        <input
          [id]="inputId"
          [type]="nativeType()"
          [min]="min() ?? null"
          [max]="max() ?? null"
          [disabled]="disabled()"
          [required]="required()"
          [value]="displayValue()"
          (input)="onInput($event)"
          (blur)="onBlur()"
        />
        @if (clearable() && displayValue()) {
          <button
            type="button"
            class="ui2-dp__clear"
            (click)="clearValue()"
            tabindex="-1"
            aria-label="Limpiar"
          >
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        }
      </div>
      @if (error()) {
        <p class="ui2-dp__msg ui2-dp__msg--error">{{ error() }}</p>
      } @else if (hint()) {
        <p class="ui2-dp__msg">{{ hint() }}</p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-dp { display: flex; flex-direction: column; gap: 6px; }
    .ui2-dp__label {
      font-family: Galvji, sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: var(--ink-700);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ui2-dp__required { color: var(--danger); }
    .ui2-dp__shell {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 14px;
      background: var(--cream-50);
      border: 1px solid var(--ink-300);
      border-radius: 14px;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .ui2-dp__shell:focus-within {
      border-color: var(--kengo-primary);
      box-shadow: 0 0 0 3px rgba(var(--kengo-primary-rgb), 0.15);
      background: white;
    }
    .ui2-dp__shell--error { border-color: var(--danger); }
    .ui2-dp__shell--error:focus-within { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15); }
    .ui2-dp__shell--disabled { opacity: 0.6; cursor: not-allowed; }
    .ui2-dp__shell input {
      flex: 1;
      min-width: 0;
      padding: 12px 0;
      border: 0;
      background: transparent;
      font-family: Galvji, sans-serif;
      font-size: 14px;
      color: var(--ink-900);
      outline: none;
    }
    .ui2-dp__shell input::-webkit-calendar-picker-indicator { cursor: pointer; }
    .ui2-dp__icon { font-size: 20px; color: var(--ink-500); flex-shrink: 0; }
    .ui2-dp__clear {
      background: transparent;
      border: 0;
      padding: 4px;
      color: var(--ink-500);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
    }
    .ui2-dp__clear:hover { color: var(--ink-700); }
    .ui2-dp__msg {
      font-size: 11px;
      color: var(--ink-500);
      margin: 0;
      padding: 0 4px;
    }
    .ui2-dp__msg--error { color: var(--danger); font-weight: 600; }
  `],
})
export class Ui2DatepickerComponent implements ControlValueAccessor {
  readonly label = input<string | null>(null);
  readonly mode = input<Ui2DatepickerMode>('date');
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly required = input<boolean>(false);
  readonly clearable = input<boolean>(true);
  /** Uso imperativo (sin Reactive Forms): pasa el valor inicial / actualizado. */
  readonly value = input<string | null>(null);
  /** Emitido en cada cambio (también con CVA). */
  readonly valueChange = output<string | null>();

  readonly inputId = `ui2-dp-${++nextId}`;
  readonly displayValue = signal<string>('');
  readonly disabled = signal<boolean>(false);

  readonly nativeType = computed(() => {
    switch (this.mode()) {
      case 'datetime': return 'datetime-local';
      case 'time': return 'time';
      default: return 'date';
    }
  });

  readonly leadingIcon = computed(() => (this.mode() === 'time' ? 'schedule' : 'calendar_today'));

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // Sync input `value` (uso imperativo) → signal interno.
    effect(() => {
      const v = this.value();
      if (v === null || v === undefined) return;
      const next = String(v);
      if (next !== this.displayValue()) {
        this.displayValue.set(next);
      }
    });
  }

  onInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.displayValue.set(v);
    this.onChange(v || null);
    this.valueChange.emit(v || null);
  }

  onBlur(): void {
    this.onTouched();
  }

  clearValue(): void {
    this.displayValue.set('');
    this.onChange(null);
    this.valueChange.emit(null);
    this.onTouched();
  }

  writeValue(value: string | Date | null): void {
    if (!value) {
      this.displayValue.set('');
      return;
    }
    if (value instanceof Date) {
      this.displayValue.set(this.toIsoForMode(value));
      return;
    }
    this.displayValue.set(String(value));
  }
  registerOnChange(fn: (value: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }

  private toIsoForMode(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    if (this.mode() === 'time') return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    if (this.mode() === 'datetime') return `${y}-${m}-${d}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return `${y}-${m}-${d}`;
  }
}
