import { Component, Input, forwardRef, signal, ElementRef, HostListener } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'ui-select',
  standalone: true,
  imports: [],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui-select-wrapper" [class.has-error]="error" [class.disabled]="disabled">
      @if (label) {
        <label [for]="selectId" class="ui-select-label">
          {{ label }}
          @if (required) {
            <span class="text-red-500">*</span>
          }
        </label>
      }

      <div class="ui-select-container">
        <button
          type="button"
          [id]="selectId"
          [disabled]="disabled"
          [class]="selectClasses"
          (click)="toggleDropdown()"
          (blur)="handleBlur()"
        >
          <span [class.text-gray-400]="!selectedLabel">
            {{ selectedLabel || placeholder }}
          </span>
          <span class="material-symbols-outlined text-xl transition-transform duration-200"
                [class.rotate-180]="isOpen()">
            expand_more
          </span>
        </button>

        @if (isOpen()) {
          <div class="ui-select-dropdown">
            @for (option of options; track option.value) {
              <button
                type="button"
                class="ui-select-option"
                [class.selected]="isSelected(option.value)"
                [class.disabled]="option.disabled"
                [disabled]="option.disabled"
                (mousedown)="selectOption(option)"
              >
                @if (multiple && isSelected(option.value)) {
                  <span class="material-symbols-outlined text-primary text-lg">check</span>
                }
                {{ option.label }}
              </button>
            }
            @if (options.length === 0) {
              <div class="ui-select-empty">Sin opciones disponibles</div>
            }
          </div>
        }
      </div>

      @if (error) {
        <p class="ui-select-error">{{ error }}</p>
      } @else if (hint) {
        <p class="ui-select-hint">{{ hint }}</p>
      }
    </div>
  `,
  styles: [`
    .ui-select-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      width: 100%;
      position: relative;
    }

    .ui-select-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .ui-select-container {
      position: relative;
    }

    .ui-select-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      max-height: 240px;
      overflow-y: auto;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.75rem;
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      z-index: 50;
    }

    .ui-select-option {
      width: 100%;
      padding: 0.625rem 0.75rem;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: background-color 0.15s;
      cursor: pointer;
      border: none;
      background: transparent;
    }

    .ui-select-option:hover:not(.disabled) {
      background-color: #f3f4f6;
    }

    .ui-select-option.selected {
      background-color: #fef3f2;
      color: var(--kengo-primary);
    }

    .ui-select-option.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ui-select-empty {
      padding: 0.75rem;
      text-align: center;
      color: #9ca3af;
      font-size: 0.875rem;
    }

    .ui-select-error {
      font-size: 0.75rem;
      color: #dc2626;
      margin: 0;
    }

    .ui-select-hint {
      font-size: 0.75rem;
      color: #6b7280;
      margin: 0;
    }

    .ui-select-wrapper.disabled {
      opacity: 0.6;
    }
  `]
})
export class SelectComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() placeholder = 'Seleccionar...';
  @Input() options: SelectOption[] = [];
  @Input() error?: string;
  @Input() hint?: string;
  @Input() disabled = false;
  @Input() required = false;
  @Input() multiple = false;

  isOpen = signal(false);
  value: string | number | (string | number)[] = '';

  private static idCounter = 0;
  selectId = `ui-select-${++SelectComponent.idCounter}`;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange: (value: string | number | (string | number)[]) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  get selectedLabel(): string {
    if (this.multiple) {
      const selectedValues = Array.isArray(this.value) ? this.value : [];
      const selectedOptions = this.options.filter(o => selectedValues.includes(o.value));
      return selectedOptions.map(o => o.label).join(', ');
    }
    const selected = this.options.find(o => o.value === this.value);
    return selected?.label ?? '';
  }

  get selectClasses(): string {
    const base = 'w-full px-3 py-2.5 text-base bg-white border rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-50 disabled:cursor-not-allowed flex items-center justify-between text-left';
    const borderColor = this.error ? 'border-red-500' : 'border-gray-300';
    return `${base} ${borderColor}`;
  }

  toggleDropdown(): void {
    if (!this.disabled) {
      this.isOpen.update(v => !v);
    }
  }

  handleBlur(): void {
    // Delay to allow option click to register
    setTimeout(() => {
      if (!this.multiple) {
        this.isOpen.set(false);
      }
      this.onTouched();
    }, 150);
  }

  isSelected(value: string | number): boolean {
    if (this.multiple) {
      return Array.isArray(this.value) && this.value.includes(value);
    }
    return this.value === value;
  }

  selectOption(option: SelectOption): void {
    if (option.disabled) return;

    if (this.multiple) {
      const currentValues = Array.isArray(this.value) ? [...this.value] : [];
      const index = currentValues.indexOf(option.value);
      if (index > -1) {
        currentValues.splice(index, 1);
      } else {
        currentValues.push(option.value);
      }
      this.value = currentValues;
    } else {
      this.value = option.value;
      this.isOpen.set(false);
    }
    this.onChange(this.value);
  }

  // ControlValueAccessor implementation
  writeValue(value: string | number | (string | number)[]): void {
    this.value = value ?? (this.multiple ? [] : '');
  }

  registerOnChange(fn: (value: string | number | (string | number)[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
