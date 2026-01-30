import { Component, Input, forwardRef, signal, ElementRef, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';

@Component({
  selector: 'ui-input',
  standalone: true,
  imports: [ReactiveFormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui-input-wrapper" [class.has-error]="error" [class.disabled]="disabled">
      @if (label) {
        <label [for]="inputId" class="ui-input-label">
          {{ label }}
          @if (required) {
            <span class="text-red-500">*</span>
          }
        </label>
      }

      <div class="ui-input-container">
        @if (iconLeft) {
          <span class="ui-input-icon left">
            <span class="material-symbols-outlined">{{ iconLeft }}</span>
          </span>
        }

        <input
          #inputRef
          [id]="inputId"
          [type]="currentType"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [readonly]="readonly"
          [autocomplete]="autocomplete"
          [value]="value"
          (input)="onInput($event)"
          (blur)="onTouched()"
          [class]="inputClasses"
        />

        @if (type === 'password') {
          <button
            type="button"
            class="ui-input-icon right cursor-pointer hover:text-primary"
            (click)="togglePassword()"
            tabindex="-1"
          >
            <span class="material-symbols-outlined">
              {{ showPassword() ? 'visibility_off' : 'visibility' }}
            </span>
          </button>
        } @else if (iconRight) {
          <span class="ui-input-icon right">
            <span class="material-symbols-outlined">{{ iconRight }}</span>
          </span>
        }
      </div>

      @if (error) {
        <p class="ui-input-error">{{ error }}</p>
      } @else if (hint) {
        <p class="ui-input-hint">{{ hint }}</p>
      }
    </div>
  `,
  styles: [`
    .ui-input-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      width: 100%;
    }

    .ui-input-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .ui-input-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    .ui-input-icon {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
      pointer-events: none;
    }

    .ui-input-icon.left {
      left: 0.75rem;
    }

    .ui-input-icon.right {
      right: 0.75rem;
      pointer-events: auto;
    }

    .ui-input-icon .material-symbols-outlined {
      font-size: 1.25rem;
    }

    .ui-input-error {
      font-size: 0.75rem;
      color: #dc2626;
      margin: 0;
    }

    .ui-input-hint {
      font-size: 0.75rem;
      color: #6b7280;
      margin: 0;
    }

    .ui-input-wrapper.disabled {
      opacity: 0.6;
    }

    .ui-input-wrapper.disabled .ui-input-label {
      color: #9ca3af;
    }
  `]
})
export class InputComponent implements ControlValueAccessor {
  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;

  @Input() label?: string;
  @Input() placeholder = '';
  @Input() type: InputType = 'text';
  @Input() error?: string;
  @Input() hint?: string;
  @Input() iconLeft?: string;
  @Input() iconRight?: string;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() required = false;
  @Input() autocomplete = 'off';

  value = '';
  showPassword = signal(false);

  private static idCounter = 0;
  inputId = `ui-input-${++InputComponent.idCounter}`;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange: (value: string) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTouched: () => void = () => {};

  get currentType(): string {
    if (this.type === 'password') {
      return this.showPassword() ? 'text' : 'password';
    }
    return this.type;
  }

  get inputClasses(): string {
    const base = 'w-full px-3 py-2.5 text-base bg-white border rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-50 disabled:cursor-not-allowed';
    const borderColor = this.error ? 'border-red-500' : 'border-gray-300';
    const paddingLeft = this.iconLeft ? 'pl-10' : '';
    const paddingRight = this.iconRight || this.type === 'password' ? 'pr-10' : '';

    return `${base} ${borderColor} ${paddingLeft} ${paddingRight}`;
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.value = value ?? '';
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
