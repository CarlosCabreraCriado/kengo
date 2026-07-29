import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HapticsService } from '../../../core/services/haptics.service';

let nextId = 0;

/**
 * Checkbox V2 — cuadrado con radio 6 px, coral al marcarse.
 *
 * Existe separado de `ui2-toggle` porque no son intercambiables: un toggle
 * expresa "activar/desactivar una preferencia" y se lee como `role="switch"`,
 * mientras que un consentimiento legal necesita la semántica de casilla
 * (`input[type=checkbox]`) y quedar sin marcar por defecto. Usarlo para
 * aceptar términos es además lo que esperan los lectores de pantalla.
 *
 * El contenido proyectado es la etiqueta, de modo que puede incluir enlaces a
 * los documentos legales.
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
    <div class="ui2-checkbox" [class.ui2-checkbox--error]="!!error()">
      <input
        type="checkbox"
        class="ui2-checkbox__input"
        [id]="inputId"
        [checked]="state()"
        [disabled]="disabled()"
        [attr.aria-describedby]="error() ? inputId + '-err' : null"
        (change)="onToggle($event)"
        (blur)="onTouched()"
      />
      <label class="ui2-checkbox__label" [attr.for]="inputId">
        <ng-content />
      </label>
    </div>
    @if (error()) {
      <p class="ui2-checkbox__msg" [id]="inputId + '-err'" role="alert">
        {{ error() }}
      </p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .ui2-checkbox {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }

      /* Se estiliza el input nativo en lugar de ocultarlo tras un span: así
         el foco del teclado y el modo de alto contraste siguen funcionando. */
      .ui2-checkbox__input {
        appearance: none;
        -webkit-appearance: none;
        flex: 0 0 auto;
        width: 20px;
        height: 20px;
        margin: 1px 0 0;
        border: 1.5px solid var(--ink-300);
        border-radius: 6px;
        background: #fff;
        cursor: pointer;
        display: grid;
        place-content: center;
        transition: background 0.15s, border-color 0.15s;
      }

      .ui2-checkbox__input::before {
        content: '';
        width: 11px;
        height: 11px;
        transform: scale(0);
        transition: transform 0.12s ease-in-out;
        box-shadow: inset 1em 1em #fff;
        clip-path: polygon(
          14% 44%,
          0 65%,
          50% 100%,
          100% 16%,
          80% 0%,
          43% 62%
        );
      }

      .ui2-checkbox__input:checked {
        background: var(--kengo-primary);
        border-color: var(--kengo-primary);
      }

      .ui2-checkbox__input:checked::before {
        transform: scale(1);
      }

      .ui2-checkbox__input:focus-visible {
        outline: 2px solid var(--kengo-primary);
        outline-offset: 2px;
      }

      .ui2-checkbox__input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .ui2-checkbox--error .ui2-checkbox__input {
        border-color: var(--danger);
      }

      .ui2-checkbox__label {
        font-size: 13px;
        line-height: 1.5;
        color: var(--ink-700);
        cursor: pointer;
      }

      .ui2-checkbox__msg {
        margin: 6px 0 0 30px;
        font-size: 12px;
        color: var(--danger);
      }
    `,
  ],
})
export class Ui2CheckboxComponent implements ControlValueAccessor {
  private readonly haptics = inject(HapticsService);

  readonly checked = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly valueChange = output<boolean>();

  protected readonly inputId = `ui2-checkbox-${nextId++}`;
  protected readonly disabled = signal(false);
  private readonly internal = signal<boolean | null>(null);

  protected readonly state = computed<boolean>(
    () => this.internal() ?? this.checked(),
  );

  private onChangeFn: (value: boolean) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  constructor() {
    effect(() => {
      this.checked();
      this.internal.set(null);
    });
  }

  protected onToggle(event: Event): void {
    if (this.disabled()) return;
    const next = (event.target as HTMLInputElement).checked;
    void this.haptics.impact('light');
    this.internal.set(next);
    this.onChangeFn(next);
    this.onTouched();
    this.valueChange.emit(next);
  }

  writeValue(value: boolean): void {
    this.internal.set(!!value);
  }
  registerOnChange(fn: (value: boolean) => void): void {
    this.onChangeFn = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
