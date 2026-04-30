import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';

let nextId = 0;

/**
 * Input V2 — fondo cream-50, border ink-300, radius 14, focus coral.
 * Soporta iconos Material a izq/der y password toggle automático.
 */
@Component({
  selector: 'ui2-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Ui2InputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui2-input">
      @if (label()) {
        <label class="ui2-input__label" [attr.for]="inputId">{{ label() }}@if (required()) {<span class="ui2-input__required" aria-hidden="true"> *</span>}</label>
      }
      <div class="ui2-input__shell" [class.ui2-input__shell--error]="!!error()" [class.ui2-input__shell--disabled]="disabled()">
        @if (iconLeft()) {
          <span class="material-symbols-outlined ui2-input__icon" aria-hidden="true">{{ iconLeft() }}</span>
        }
        <input
          [id]="inputId"
          [type]="effectiveType()"
          [placeholder]="placeholder()"
          [readOnly]="readonly()"
          [disabled]="disabled()"
          [required]="required()"
          [autocomplete]="autocomplete()"
          [value]="value()"
          (input)="onInput($event)"
          (blur)="onBlur()"
        />
        @if (type() === 'password') {
          <button
            type="button"
            class="ui2-input__pwd-toggle"
            [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            (click)="showPassword.set(!showPassword())"
          >
            <span class="material-symbols-outlined" aria-hidden="true">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
          </button>
        } @else if (iconRight()) {
          <span class="material-symbols-outlined ui2-input__icon" aria-hidden="true">{{ iconRight() }}</span>
        }
      </div>
      @if (error()) {
        <p class="ui2-input__msg ui2-input__msg--error">{{ error() }}</p>
      } @else if (hint()) {
        <p class="ui2-input__msg">{{ hint() }}</p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-input { display: flex; flex-direction: column; gap: 6px; }
    .ui2-input__label {
      font-family: Galvji, sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: var(--ink-700);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ui2-input__required { color: var(--danger); }
    .ui2-input__shell {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 14px;
      background: var(--cream-50);
      border: 1px solid var(--ink-300);
      border-radius: 14px;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .ui2-input__shell:focus-within {
      border-color: var(--kengo-primary);
      box-shadow: 0 0 0 3px rgba(var(--kengo-primary-rgb), 0.15);
      background: white;
    }
    .ui2-input__shell--error {
      border-color: var(--danger);
    }
    .ui2-input__shell--error:focus-within {
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
    }
    .ui2-input__shell--disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .ui2-input__shell input {
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
    .ui2-input__shell input::placeholder { color: var(--ink-400); }
    .ui2-input__icon {
      font-size: 20px;
      color: var(--ink-500);
      flex-shrink: 0;
    }
    .ui2-input__pwd-toggle {
      background: transparent;
      border: 0;
      padding: 4px;
      color: var(--ink-500);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
    }
    .ui2-input__pwd-toggle:hover { color: var(--ink-700); }
    .ui2-input__msg {
      font-size: 11px;
      color: var(--ink-500);
      margin: 0;
      padding: 0 4px;
    }
    .ui2-input__msg--error { color: var(--danger); font-weight: 600; }
  `],
})
export class Ui2InputComponent implements ControlValueAccessor {
  readonly label = input<string | null>(null);
  readonly placeholder = input<string>('');
  readonly type = input<InputType>('text');
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly iconLeft = input<string | null>(null);
  readonly iconRight = input<string | null>(null);
  readonly required = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly autocomplete = input<string>('off');

  readonly inputId = `ui2-input-${++nextId}`;
  readonly value = signal<string>('');
  readonly disabled = signal<boolean>(false);
  readonly showPassword = signal<boolean>(false);

  readonly effectiveType = computed(() => {
    if (this.type() === 'password' && this.showPassword()) return 'text';
    return this.type();
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  onInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
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
