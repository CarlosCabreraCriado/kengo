import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  forwardRef,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'ui-search-box',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchBoxComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui-search-box">
      <span
        class="material-symbols-outlined ui-search-box__icon"
        aria-hidden="true"
      >search</span>
      <input
        #input
        type="search"
        class="ui-search-box__input"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [value]="value()"
        [attr.aria-label]="ariaLabel || placeholder"
        (input)="onInput($event)"
        (blur)="onTouched()"
      />
      @if (value()) {
        <button
          type="button"
          class="ui-search-box__clear"
          aria-label="Borrar búsqueda"
          (click)="clear()"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .ui-search-box {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }

    .ui-search-box__icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--kengo-primary);
      font-size: 1.25rem;
      pointer-events: none;
      z-index: 1;
    }

    .ui-search-box__input {
      width: 100%;
      height: 3rem;
      padding: 0 2.5rem 0 2.75rem;
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.4);
      color: #3f3f46;
      font-size: 0.875rem;
      transition: all 0.2s ease;
      outline: none;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }

    .ui-search-box__input:focus {
      border-color: rgba(var(--kengo-primary-rgb), 0.4);
      background: rgba(255, 255, 255, 0.9);
    }

    .ui-search-box__input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .ui-search-box__input::-webkit-search-cancel-button {
      display: none;
    }

    .ui-search-box__clear {
      position: absolute;
      right: 0.5rem;
      top: 50%;
      transform: translateY(-50%);
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      background: transparent;
      color: #a1a1aa;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
    }

    .ui-search-box__clear:hover {
      background: #f4f4f5;
      color: #52525b;
    }

    .ui-search-box__clear .material-symbols-outlined {
      font-size: 1.125rem;
    }
  `],
})
export class SearchBoxComponent implements ControlValueAccessor {
  @Input() placeholder = 'Buscar...';
  @Input() ariaLabel?: string;
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<string>();

  value = signal('');

  private onChange: (value: string) => void = () => {
    /* noop */
  };
  onTouched: () => void = () => {
    /* noop */
  };

  onInput(event: Event) {
    const newValue = (event.target as HTMLInputElement).value;
    this.value.set(newValue);
    this.onChange(newValue);
    this.valueChange.emit(newValue);
  }

  clear() {
    this.value.set('');
    this.onChange('');
    this.valueChange.emit('');
  }

  // ControlValueAccessor
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
    this.disabled = isDisabled;
  }
}
