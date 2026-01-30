import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

declare const flatpickr: (
  element: HTMLElement,
  options: Record<string, unknown>
) => {
  destroy: () => void;
  setDate: (date: Date | Date[] | string | null, triggerChange?: boolean) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

@Component({
  selector: 'ui-datepicker',
  standalone: true,
  imports: [],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatepickerComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui-datepicker-wrapper" [class.has-error]="error" [class.disabled]="disabled">
      @if (label) {
        <label [for]="inputId" class="ui-datepicker-label">
          {{ label }}
          @if (required) {
            <span class="text-red-500">*</span>
          }
        </label>
      }

      <div class="ui-datepicker-container">
        <span class="ui-datepicker-icon left">
          <span class="material-symbols-outlined">calendar_today</span>
        </span>

        <input
          #dateInput
          [id]="inputId"
          type="text"
          [placeholder]="placeholder"
          [disabled]="disabled"
          readonly
          [class]="inputClasses"
        />

        @if (clearable && hasValue) {
          <button
            type="button"
            class="ui-datepicker-clear"
            (click)="clear()"
            tabindex="-1"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        }
      </div>

      @if (error) {
        <p class="ui-datepicker-error">{{ error }}</p>
      } @else if (hint) {
        <p class="ui-datepicker-hint">{{ hint }}</p>
      }
    </div>
  `,
  styles: [`
    .ui-datepicker-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      width: 100%;
    }

    .ui-datepicker-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .ui-datepicker-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    .ui-datepicker-icon {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
      pointer-events: none;
    }

    .ui-datepicker-icon.left {
      left: 0.75rem;
    }

    .ui-datepicker-icon .material-symbols-outlined {
      font-size: 1.25rem;
    }

    .ui-datepicker-clear {
      position: absolute;
      right: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border: none;
      background: transparent;
      color: #9ca3af;
      cursor: pointer;
      border-radius: 0.25rem;
      transition: all 0.15s;
    }

    .ui-datepicker-clear:hover {
      color: #374151;
      background-color: #f3f4f6;
    }

    .ui-datepicker-clear .material-symbols-outlined {
      font-size: 1rem;
    }

    .ui-datepicker-error {
      font-size: 0.75rem;
      color: #dc2626;
      margin: 0;
    }

    .ui-datepicker-hint {
      font-size: 0.75rem;
      color: #6b7280;
      margin: 0;
    }

    .ui-datepicker-wrapper.disabled {
      opacity: 0.6;
    }
  `]
})
export class DatepickerComponent implements OnInit, AfterViewInit, OnDestroy, ControlValueAccessor {
  @ViewChild('dateInput') dateInput!: ElementRef<HTMLInputElement>;

  @Input() label?: string;
  @Input() placeholder = 'Seleccionar fecha';
  @Input() error?: string;
  @Input() hint?: string;
  @Input() disabled = false;
  @Input() required = false;
  @Input() clearable = true;
  @Input() mode: 'single' | 'range' | 'multiple' = 'single';
  @Input() minDate?: Date | string;
  @Input() maxDate?: Date | string;
  @Input() dateFormat = 'd/m/Y';
  @Input() enableTime = false;
  @Input() time24hr = true;

  @Output() dateChange = new EventEmitter<Date | Date[] | null>();

  private flatpickrInstance: ReturnType<typeof flatpickr> | null = null;
  private value: Date | Date[] | null = null;

  private static idCounter = 0;
  inputId = `ui-datepicker-${++DatepickerComponent.idCounter}`;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange: (value: Date | Date[] | null) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTouched: () => void = () => {};

  get hasValue(): boolean {
    if (Array.isArray(this.value)) {
      return this.value.length > 0;
    }
    return this.value !== null;
  }

  get inputClasses(): string {
    const base = 'w-full pl-10 pr-10 py-2.5 text-base bg-white border rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-50 disabled:cursor-not-allowed cursor-pointer';
    const borderColor = this.error ? 'border-red-500' : 'border-gray-300';
    return `${base} ${borderColor}`;
  }

  ngOnInit(): void {
    // Dynamically load Flatpickr if not available
    if (typeof flatpickr === 'undefined') {
      this.loadFlatpickr();
    }
  }

  ngAfterViewInit(): void {
    // Wait for Flatpickr to load if needed
    this.initFlatpickr();
  }

  ngOnDestroy(): void {
    if (this.flatpickrInstance) {
      this.flatpickrInstance.destroy();
    }
  }

  private loadFlatpickr(): void {
    // Load CSS
    if (!document.querySelector('link[href*="flatpickr"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
      document.head.appendChild(link);
    }

    // Load JS
    if (!document.querySelector('script[src*="flatpickr"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
      script.onload = () => {
        // Load Spanish locale
        const localeScript = document.createElement('script');
        localeScript.src = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/es.js';
        localeScript.onload = () => this.initFlatpickr();
        document.head.appendChild(localeScript);
      };
      document.head.appendChild(script);
    }
  }

  private initFlatpickr(): void {
    if (typeof flatpickr === 'undefined' || !this.dateInput) {
      setTimeout(() => this.initFlatpickr(), 100);
      return;
    }

    const options: Record<string, unknown> = {
      locale: 'es',
      mode: this.mode,
      dateFormat: this.dateFormat,
      enableTime: this.enableTime,
      time_24hr: this.time24hr,
      minDate: this.minDate,
      maxDate: this.maxDate,
      disableMobile: true,
      onChange: (selectedDates: Date[]) => {
        if (this.mode === 'single') {
          this.value = selectedDates[0] || null;
        } else {
          this.value = selectedDates;
        }
        this.onChange(this.value);
        this.dateChange.emit(this.value);
      },
      onClose: () => {
        this.onTouched();
      },
    };

    this.flatpickrInstance = flatpickr(this.dateInput.nativeElement, options);

    if (this.value) {
      this.flatpickrInstance.setDate(this.value as Date | Date[], false);
    }
  }

  clear(): void {
    if (this.flatpickrInstance) {
      this.flatpickrInstance.clear();
    }
    this.value = null;
    this.onChange(null);
    this.dateChange.emit(null);
  }

  // ControlValueAccessor implementation
  writeValue(value: Date | Date[] | null): void {
    this.value = value;
    if (this.flatpickrInstance && value) {
      this.flatpickrInstance.setDate(value as Date | Date[], false);
    }
  }

  registerOnChange(fn: (value: Date | Date[] | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
