import { ChangeDetectionStrategy, Component, computed, effect, forwardRef, inject, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HapticsService } from '../../../core/services/haptics.service';

/**
 * Toggle iOS-style V2 — coral cuando está activo, animación translateX 16px.
 * Soporta uso reactivo (Reactive Forms vía ControlValueAccessor) o controlado (input `checked` + output `valueChange`).
 */
@Component({
  selector: 'ui2-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Ui2ToggleComponent),
      multi: true,
    },
  ],
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="state()"
      [attr.aria-label]="ariaLabel()"
      [disabled]="disabled()"
      class="ui2-toggle"
      [class.ui2-toggle--on]="state()"
      (click)="toggle()"
    >
      <span class="ui2-toggle__thumb" [class.ui2-toggle__thumb--on]="state()"></span>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .ui2-toggle {
      width: 42px;
      height: 26px;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.12);
      padding: 3px;
      border: 0;
      cursor: pointer;
      transition: background 0.15s;
      display: inline-flex;
      align-items: center;
    }
    .ui2-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
    .ui2-toggle--on {
      background: var(--kengo-primary);
      box-shadow: var(--shadow-toggle-coral);
    }
    .ui2-toggle__thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transform: translateX(0);
      transition: transform 0.15s;
    }
    .ui2-toggle__thumb--on { transform: translateX(16px); }
  `],
})
export class Ui2ToggleComponent implements ControlValueAccessor {
  private readonly haptics = inject(HapticsService);

  readonly checked = input<boolean>(false);
  readonly ariaLabel = input<string>('Toggle');
  readonly valueChange = output<boolean>();

  readonly disabled = signal(false);
  private readonly internal = signal<boolean | null>(null);

  // Si hay valor interno (CVA o click), úsalo; si no, refleja `checked` input.
  readonly state = computed<boolean>(() => {
    const i = this.internal();
    return i ?? this.checked();
  });

  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // Resetear el override interno cada vez que cambie el input externo `checked`.
    effect(() => {
      this.checked();
      this.internal.set(null);
    });
  }

  toggle(): void {
    if (this.disabled()) return;
    const next = !this.state();
    void this.haptics.impact('light');
    this.internal.set(next);
    this.onChange(next);
    this.onTouched();
    this.valueChange.emit(next);
  }

  writeValue(value: boolean): void {
    this.internal.set(!!value);
  }
  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
