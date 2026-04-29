import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

/**
 * Checkbox V2 — caja radius 6, checked → coral fill + check blanco.
 */
@Component({
  selector: 'ui2-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Ui2CheckboxComponent),
      multi: true,
    },
  ],
  template: `
    <label class="ui2-checkbox" [class.ui2-checkbox--disabled]="disabled()">
      <input
        type="checkbox"
        [id]="checkboxId"
        [checked]="value()"
        [disabled]="disabled()"
        (change)="onChangeEvent($event)"
        (blur)="onBlur()"
      />
      <span class="ui2-checkbox__box" [class.ui2-checkbox__box--checked]="value()">
        @if (value()) {
          <span class="material-symbols-outlined ui2-checkbox__check" aria-hidden="true">check</span>
        }
      </span>
      @if (label()) {
        <span class="ui2-checkbox__label">{{ label() }}</span>
      }
    </label>
  `,
  styles: [`
    :host { display: inline-flex; }
    .ui2-checkbox {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      user-select: none;
    }
    .ui2-checkbox--disabled { opacity: 0.5; cursor: not-allowed; }
    .ui2-checkbox input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .ui2-checkbox__box {
      display: inline-grid;
      place-items: center;
      width: 20px;
      height: 20px;
      border-radius: 6px;
      border: 1.5px solid var(--ink-300);
      background: var(--cream-50);
      transition: background 0.15s, border-color 0.15s;
      flex-shrink: 0;
    }
    .ui2-checkbox:hover .ui2-checkbox__box {
      border-color: var(--kengo-primary);
    }
    .ui2-checkbox__box--checked {
      background: var(--kengo-primary);
      border-color: var(--kengo-primary);
    }
    .ui2-checkbox__check {
      color: white;
      font-size: 16px;
      font-weight: 800;
    }
    .ui2-checkbox__label {
      font-size: 14px;
      color: var(--ink-900);
      line-height: 1.3;
    }
    .ui2-checkbox input:focus-visible + .ui2-checkbox__box {
      box-shadow: 0 0 0 3px rgba(231, 92, 62, 0.2);
    }
  `],
})
export class Ui2CheckboxComponent implements ControlValueAccessor {
  readonly label = input<string | null>(null);

  readonly checkboxId = `ui2-checkbox-${++nextId}`;
  readonly value = signal<boolean>(false);
  readonly disabled = signal<boolean>(false);

  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  onChangeEvent(event: Event): void {
    const v = (event.target as HTMLInputElement).checked;
    this.value.set(v);
    this.onChange(v);
  }
  onBlur(): void { this.onTouched(); }

  writeValue(value: boolean | null): void { this.value.set(!!value); }
  registerOnChange(fn: (value: boolean) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
}
