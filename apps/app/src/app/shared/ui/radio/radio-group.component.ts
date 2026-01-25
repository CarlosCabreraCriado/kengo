import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface RadioOption {
  value: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
}

@Component({
  selector: 'ui-radio-group',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RadioGroupComponent),
      multi: true,
    },
  ],
  template: `
    <fieldset class="ui-radio-group" [class.disabled]="disabled">
      @if (label) {
        <legend class="ui-radio-group-label">{{ label }}</legend>
      }

      <div class="ui-radio-options" [class.horizontal]="orientation === 'horizontal'">
        @for (option of options; track option.value) {
          <label class="ui-radio" [class.disabled]="option.disabled || disabled">
            <input
              type="radio"
              [name]="name"
              [value]="option.value"
              [checked]="value === option.value"
              [disabled]="option.disabled || disabled"
              (change)="onSelect(option.value)"
              class="sr-only peer"
            />
            <span class="ui-radio-circle peer-focus-visible:ring-2 peer-focus-visible:ring-primary/20">
              @if (value === option.value) {
                <span class="ui-radio-dot"></span>
              }
            </span>
            <div class="ui-radio-text">
              <span class="ui-radio-label">{{ option.label }}</span>
              @if (option.description) {
                <span class="ui-radio-description">{{ option.description }}</span>
              }
            </div>
          </label>
        }
      </div>

      @if (error) {
        <p class="ui-radio-error">{{ error }}</p>
      }
    </fieldset>
  `,
  styles: [`
    .ui-radio-group {
      border: none;
      padding: 0;
      margin: 0;
    }

    .ui-radio-group-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .ui-radio-options {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .ui-radio-options.horizontal {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .ui-radio {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      cursor: pointer;
      user-select: none;
    }

    .ui-radio.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ui-radio-circle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      border: 2px solid #d1d5db;
      border-radius: 50%;
      background-color: white;
      transition: all 0.15s;
      flex-shrink: 0;
      margin-top: 0.125rem;
    }

    .ui-radio input:checked + .ui-radio-circle {
      border-color: #e75c3e;
    }

    .ui-radio:hover:not(.disabled) .ui-radio-circle {
      border-color: #e75c3e;
    }

    .ui-radio-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background-color: #e75c3e;
    }

    .ui-radio-text {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .ui-radio-label {
      font-size: 0.9375rem;
      color: #374151;
    }

    .ui-radio-description {
      font-size: 0.8125rem;
      color: #6b7280;
    }

    .ui-radio-error {
      margin-top: 0.375rem;
      font-size: 0.75rem;
      color: #dc2626;
    }

    .ui-radio-group.disabled {
      opacity: 0.6;
    }
  `]
})
export class RadioGroupComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() options: RadioOption[] = [];
  @Input() error?: string;
  @Input() disabled = false;
  @Input() orientation: 'vertical' | 'horizontal' = 'vertical';

  value: string | number = '';

  private static idCounter = 0;
  name = `ui-radio-group-${++RadioGroupComponent.idCounter}`;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange: (value: string | number) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTouched: () => void = () => {};

  onSelect(value: string | number): void {
    this.value = value;
    this.onChange(this.value);
    this.onTouched();
  }

  // ControlValueAccessor implementation
  writeValue(value: string | number): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string | number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
