import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, forwardRef, input, output, signal, viewChild } from '@angular/core';
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
        #field
        [id]="searchId"
        type="search"
        inputmode="search"
        enterkeyhint="search"
        autocorrect="off"
        [placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel() ?? placeholder()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (blur)="onBlur()"
      />
      <!-- Siempre montado: crear/destruir el botón relayouta con el input
           enfocado y contribuye al parpadeo del teclado en iOS. -->
      <button
        type="button"
        class="ui2-search__clear"
        [class.ui2-search__clear--hidden]="!value()"
        aria-label="Limpiar búsqueda"
        [attr.aria-hidden]="!value()"
        [tabindex]="value() ? 0 : -1"
        (click)="clear()"
      >
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
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
      border: 1px solid rgba(var(--kengo-primary-rgb), 0.6);
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
    .ui2-search__clear--hidden { visibility: hidden; pointer-events: none; }
    .ui2-search__clear .material-symbols-outlined { font-size: 18px; }
  `],
})
export class Ui2SearchBoxComponent implements ControlValueAccessor, AfterViewInit {
  readonly placeholder = input<string>('Buscar...');
  readonly ariaLabel = input<string | null>(null);

  readonly searchId = `ui2-search-${++nextId}`;
  /* Estado interno para la UI (botón clear); nunca se bindea a [value] —
     reescribir el value del input enfocado en cada tecla resetea el estado
     de autofill de WKWebView y hace parpadear la QuickType bar en iOS. El
     DOM solo se escribe en writeValue() y clear(). */
  readonly value = signal<string>('');
  readonly disabled = signal<boolean>(false);
  readonly valueChange = output<string>();

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private pendingValue: string | null = null;

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngAfterViewInit(): void {
    if (this.pendingValue !== null) {
      const el = this.field()?.nativeElement;
      if (el) el.value = this.pendingValue;
      this.pendingValue = null;
    }
  }

  onInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
    this.valueChange.emit(v);
  }
  onBlur(): void { this.onTouched(); }
  clear(): void {
    this.value.set('');
    /* Escritura imperativa: hay consumidores sin formControl donde
       writeValue() nunca llega a llamarse. */
    this.setDomValue('');
    this.onChange('');
    this.valueChange.emit('');
  }

  writeValue(value: string | number | null | undefined): void {
    const normalized = value == null ? '' : String(value);
    this.value.set(normalized);
    this.setDomValue(normalized);
  }

  private setDomValue(v: string): void {
    const el = this.field()?.nativeElement;
    if (!el) {
      this.pendingValue = v;
      return;
    }
    if (el.value !== v) el.value = v;
  }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
}
