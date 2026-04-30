import { ChangeDetectionStrategy, Component, forwardRef, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

/**
 * Search box V2 — input con icono `search` izquierda y botón clear derecho.
 */
@Component({
  selector: 'ui2-search-box',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Ui2SearchBoxComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui2-search" [class.ui2-search--disabled]="disabled()">
      <span class="material-symbols-outlined ui2-search__icon" aria-hidden="true">search</span>
      <input
        [id]="searchId"
        type="search"
        [placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel() ?? placeholder()"
        [disabled]="disabled()"
        [value]="value()"
        (input)="onInput($event)"
        (blur)="onBlur()"
      />
      @if (value()) {
        <button
          type="button"
          class="ui2-search__clear"
          aria-label="Limpiar búsqueda"
          (click)="clear()"
        >
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-search {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 14px;
      background: var(--cream-50);
      border: 1px solid var(--ink-300);
      border-radius: 14px;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .ui2-search:focus-within {
      border-color: var(--kengo-primary);
      box-shadow: 0 0 0 3px rgba(var(--kengo-primary-rgb), 0.15);
      background: white;
    }
    .ui2-search--disabled { opacity: 0.6; }
    .ui2-search__icon {
      font-size: 20px;
      color: var(--ink-500);
      flex-shrink: 0;
    }
    .ui2-search input {
      flex: 1;
      min-width: 0;
      padding: 10px 0;
      border: 0;
      background: transparent;
      font-family: Galvji, sans-serif;
      font-size: 14px;
      color: var(--ink-900);
      outline: none;
    }
    .ui2-search input::placeholder { color: var(--ink-400); }
    .ui2-search input::-webkit-search-cancel-button { display: none; }
    .ui2-search__clear {
      background: transparent;
      border: 0;
      padding: 4px;
      color: var(--ink-500);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
    }
    .ui2-search__clear:hover { color: var(--ink-900); }
    .ui2-search__clear .material-symbols-outlined { font-size: 18px; }
  `],
})
export class Ui2SearchBoxComponent implements ControlValueAccessor {
  readonly placeholder = input<string>('Buscar...');
  readonly ariaLabel = input<string | null>(null);

  readonly searchId = `ui2-search-${++nextId}`;
  readonly value = signal<string>('');
  readonly disabled = signal<boolean>(false);
  readonly valueChange = output<string>();

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  onInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
    this.valueChange.emit(v);
  }
  onBlur(): void { this.onTouched(); }
  clear(): void {
    this.value.set('');
    this.onChange('');
    this.valueChange.emit('');
  }

  writeValue(value: string | null): void { this.value.set(value ?? ''); }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
}
