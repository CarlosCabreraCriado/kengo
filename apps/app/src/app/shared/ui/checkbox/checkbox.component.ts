import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'ui-checkbox',
  standalone: true,
  imports: [],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
  template: `
    <label class="ui-checkbox" [class.disabled]="disabled">
      <input
        type="checkbox"
        [checked]="checked"
        [disabled]="disabled"
        (change)="onCheck($event)"
        class="sr-only peer"
      />
      <span class="ui-checkbox-box peer-focus-visible:ring-2 peer-focus-visible:ring-primary/20">
        @if (checked) {
          <span class="material-symbols-outlined text-white text-sm">check</span>
        }
      </span>
      @if (label) {
        <span class="ui-checkbox-label">{{ label }}</span>
      }
      <ng-content></ng-content>
    </label>
  `,
  styles: [`
    .ui-checkbox {
      display: inline-flex;
      align-items: flex-start;
      gap: 0.5rem;
      cursor: pointer;
      user-select: none;
    }

    .ui-checkbox.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ui-checkbox-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      border: 2px solid #d1d5db;
      border-radius: 0.375rem;
      background-color: white;
      transition: all 0.15s;
      flex-shrink: 0;
      margin-top: 0.125rem;
    }

    .ui-checkbox input:checked + .ui-checkbox-box {
      background-color: var(--kengo-primary);
      border-color: var(--kengo-primary);
    }

    .ui-checkbox:hover:not(.disabled) .ui-checkbox-box {
      border-color: var(--kengo-primary);
    }

    .ui-checkbox-label {
      font-size: 0.9375rem;
      color: #374151;
      line-height: 1.4;
    }
  `]
})
export class CheckboxComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() disabled = false;

  checked = false;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange: (value: boolean) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTouched: () => void = () => {};

  onCheck(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.checked = target.checked;
    this.onChange(this.checked);
    this.onTouched();
  }

  // ControlValueAccessor implementation
  writeValue(value: boolean): void {
    this.checked = value ?? false;
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
