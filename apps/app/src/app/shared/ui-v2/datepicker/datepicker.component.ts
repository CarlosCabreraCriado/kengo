import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { DialogService } from '../../services/dialog';
import { ymdToDateForDisplay } from '../../utils/madrid-date.util';
import type { Ui2DatepickerMode, Ui2DatepickerSheetData } from './datepicker.types';
// Import de solo-tipo (se borra en compilación): permite referenciar el tipo
// del componente sin cargar su código; el valor llega vía `import()` perezoso.
import type { Ui2DatepickerSheetComponent } from './datepicker-sheet.component';

let nextId = 0;

/**
 * Selector de fecha V2 (`ui2-datepicker`) — reemplazo robusto del
 * `<input type="date">` nativo.
 *
 * El trigger es un `<button>` (no un input nativo), así que no depende del
 * shadow DOM del picker de fecha del sistema, poco fiable en WKWebView/Android
 * WebView. Al tocarlo abre un bottom-sheet propio (`Ui2DatepickerSheetComponent`)
 * con un calendario. Implementa `ControlValueAccessor`: acepta/emite el mismo
 * string 'yyyy-mm-dd' que un `<input type="date">`, así que es drop-in con
 * Reactive Forms (`formControlName`).
 *
 * Nota: en esta entrega solo se implementa `mode="date"`. El union y el
 * `displayValue` quedan preparados para extender a 'datetime'/'time'.
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
        <label class="ui2-dp__label" [attr.for]="datepickerId">
          {{ label() }}@if (required()) {<span class="ui2-dp__required" aria-hidden="true"> *</span>}
        </label>
      }
      <button
        type="button"
        [id]="datepickerId"
        class="ui2-dp__shell"
        [class.ui2-dp__shell--error]="!!error()"
        [class.ui2-dp__shell--disabled]="disabled()"
        [disabled]="disabled()"
        [attr.aria-haspopup]="'dialog'"
        [attr.aria-label]="ariaLabel()"
        (click)="open()"
        (blur)="onBlur()"
      >
        <span class="material-symbols-outlined ui2-dp__icon" aria-hidden="true">calendar_today</span>
        <span class="ui2-dp__value" [class.ui2-dp__value--empty]="!value()">
          {{ displayValue() || placeholder() }}
        </span>
        <span class="material-symbols-outlined ui2-dp__chevron" aria-hidden="true">expand_more</span>
      </button>
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
      width: 100%;
      min-width: 0;
      padding: 12px 14px;
      background: var(--cream-50);
      border: 1px solid rgba(var(--kengo-primary-rgb), 0.6);
      border-radius: 14px;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .ui2-dp__shell:focus-visible {
      outline: none;
      border-color: var(--kengo-primary);
      box-shadow: 0 0 0 3px rgba(var(--kengo-primary-rgb), 0.15);
      background: white;
    }
    .ui2-dp__shell--error { border-color: var(--danger); }
    .ui2-dp__shell--error:focus-visible {
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
    }
    .ui2-dp__shell--disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .ui2-dp__icon {
      font-size: 20px;
      color: var(--ink-500);
      flex-shrink: 0;
    }
    .ui2-dp__value {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-family: Galvji, sans-serif;
      font-size: 14px;
      color: var(--ink-900);
    }
    .ui2-dp__value--empty { color: var(--ink-400); }
    .ui2-dp__chevron {
      font-size: 20px;
      color: var(--ink-500);
      flex-shrink: 0;
    }
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
  readonly placeholder = input<string>('dd/mm/aaaa');
  readonly mode = input<Ui2DatepickerMode>('date');
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly required = input<boolean>(false);

  private dialog = inject(DialogService);

  readonly datepickerId = `ui2-datepicker-${++nextId}`;
  readonly value = signal<string>('');
  readonly disabled = signal<boolean>(false);
  private opening = false;

  /** Texto visible: 'dd/mm/aaaa' del valor (o vacío). TZ-safe vía getUTC*. */
  readonly displayValue = computed(() => {
    const ymd = this.value();
    if (!ymd) return '';
    const date = ymdToDateForDisplay(ymd);
    const d = String(date.getUTCDate()).padStart(2, '0');
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${date.getUTCFullYear()}`;
  });

  readonly ariaLabel = computed(() => {
    const base = this.label() ?? 'Fecha';
    return this.value() ? `${base}: ${this.displayValue()}` : base;
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  async open(): Promise<void> {
    if (this.disabled() || this.opening) return;
    this.opening = true;
    this.onTouched();
    try {
      // Import perezoso: no arrastra el calendario al bundle de quien solo
      // pinta el trigger, y evita ciclo con el barrel de ui-v2.
      const { Ui2DatepickerSheetComponent: Sheet } = await import('./datepicker-sheet.component');
      const data: Ui2DatepickerSheetData = {
        value: this.value() || null,
        min: this.min(),
        max: this.max(),
        mode: this.mode(),
      };
      const ref = this.dialog.openSheet<Ui2DatepickerSheetComponent, Ui2DatepickerSheetData, string>(
        Sheet,
        { data },
      );
      const result = await firstValueFrom(ref.closed);
      if (result) {
        this.value.set(result);
        this.onChange(result);
      }
    } finally {
      this.opening = false;
    }
  }

  onBlur(): void {
    this.onTouched();
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
