import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'ui-textarea',
  standalone: true,
  imports: [],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextareaComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui-textarea-wrapper" [class.has-error]="error" [class.disabled]="disabled">
      @if (label) {
        <label [for]="textareaId" class="ui-textarea-label">
          {{ label }}
          @if (required) {
            <span class="text-red-500">*</span>
          }
        </label>
      }

      <textarea
        [id]="textareaId"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [readonly]="readonly"
        [rows]="rows"
        [value]="value"
        (input)="onInput($event)"
        (blur)="onTouched()"
        [class]="textareaClasses"
      ></textarea>

      <div class="flex justify-between items-start mt-1">
        @if (error) {
          <p class="ui-textarea-error">{{ error }}</p>
        } @else if (hint) {
          <p class="ui-textarea-hint">{{ hint }}</p>
        } @else {
          <span></span>
        }

        @if (showCount && maxLength) {
          <span class="ui-textarea-count" [class.text-red-500]="value.length > maxLength">
            {{ value.length }}/{{ maxLength }}
          </span>
        }
      </div>
    </div>
  `,
  styles: [`
    .ui-textarea-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      width: 100%;
    }

    .ui-textarea-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .ui-textarea-error {
      font-size: 0.75rem;
      color: #dc2626;
      margin: 0;
    }

    .ui-textarea-hint {
      font-size: 0.75rem;
      color: #6b7280;
      margin: 0;
    }

    .ui-textarea-count {
      font-size: 0.75rem;
      color: #9ca3af;
    }

    .ui-textarea-wrapper.disabled {
      opacity: 0.6;
    }

    .ui-textarea-wrapper.disabled .ui-textarea-label {
      color: #9ca3af;
    }
  `]
})
export class TextareaComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() placeholder = '';
  @Input() error?: string;
  @Input() hint?: string;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() required = false;
  @Input() rows = 4;
  @Input() maxLength?: number;
  @Input() showCount = false;
  @Input() resize: 'none' | 'vertical' | 'horizontal' | 'both' = 'vertical';

  value = '';

  private static idCounter = 0;
  textareaId = `ui-textarea-${++TextareaComponent.idCounter}`;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange: (value: string) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTouched: () => void = () => {};

  get textareaClasses(): string {
    const base = 'w-full px-3 py-2.5 text-base bg-white border rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-50 disabled:cursor-not-allowed';
    const borderColor = this.error ? 'border-red-500' : 'border-gray-300';
    const resizeClass = `resize-${this.resize}`;

    return `${base} ${borderColor} ${resizeClass}`;
  }

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
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
