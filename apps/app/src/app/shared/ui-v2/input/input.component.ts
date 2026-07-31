import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
type InputMode = 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
type EnterKeyHint = 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
type AutoCapitalize = 'off' | 'none' | 'sentences' | 'words' | 'characters';

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
          #field
          [id]="inputId"
          [type]="effectiveType()"
          [placeholder]="placeholder()"
          [readOnly]="readonly()"
          [disabled]="disabled()"
          [required]="required()"
          [autocomplete]="autocomplete()"
          [attr.inputmode]="effectiveInputmode()"
          [attr.enterkeyhint]="enterkeyhint()"
          [attr.autocapitalize]="effectiveAutocapitalize()"
          [attr.autocorrect]="effectiveAutocorrect()"
          [attr.spellcheck]="effectiveSpellcheck()"
          [attr.name]="name()"
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
      <div class="ui2-input__msg-zone">
        @if (error()) {
          <p class="ui2-input__msg ui2-input__msg--error">{{ error() }}</p>
        } @else if (hint()) {
          <p class="ui2-input__msg">{{ hint() }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-input { display: flex; flex-direction: column; }
    .ui2-input__label {
      margin-bottom: 6px;
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
      border: 1px solid rgba(var(--kengo-primary-rgb), 0.6);
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
      line-height: 16px; /* fijo para que coincida con la reserva de la msg-zone */
      color: var(--ink-500);
      margin: 6px 0 0;
      padding: 0 4px;
    }
    .ui2-input__msg--error { color: var(--danger); font-weight: 600; }
    /* Con foco se reserva una línea de mensaje para que el error pueda
       aparecer/desaparecer al teclear sin cambiar la altura del formulario
       (en iOS el relayout por tecla hace parpadear la barra del teclado). */
    .ui2-input:focus-within .ui2-input__msg-zone { min-height: 22px; }
  `],
})
export class Ui2InputComponent implements ControlValueAccessor, AfterViewInit {
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
  readonly inputmode = input<InputMode | null>(null);
  readonly enterkeyhint = input<EnterKeyHint | null>(null);
  readonly autocapitalize = input<AutoCapitalize | null>(null);
  readonly autocorrect = input<'on' | 'off' | null>(null);
  readonly spellcheck = input<boolean | null>(null);
  readonly name = input<string | null>(null);

  readonly inputId = `ui2-input-${++nextId}`;
  /* Estado interno para la UI; nunca se bindea a [value] — reescribir el
     value de un input enfocado en cada tecla resetea el estado de autofill
     de WKWebView y hace parpadear la QuickType bar en iOS. El DOM solo se
     escribe en writeValue() (cambios programáticos del modelo). */
  readonly value = signal<string>('');
  readonly disabled = signal<boolean>(false);
  readonly showPassword = signal<boolean>(false);

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private pendingValue: string | null = null;

  readonly effectiveType = computed(() => {
    if (this.type() === 'password' && this.showPassword()) return 'text';
    return this.type();
  });

  /* Defaults sensatos derivados del type — el teclado móvil se adapta sin
     que cada formulario tenga que repetir los atributos. Cualquier valor
     explícito del consumidor gana sobre el default. */
  readonly effectiveInputmode = computed<InputMode | null>(() => {
    if (this.inputmode()) return this.inputmode();
    switch (this.type()) {
      case 'email': return 'email';
      case 'tel': return 'tel';
      case 'url': return 'url';
      case 'search': return 'search';
      default: return null;
    }
  });

  readonly effectiveAutocapitalize = computed<AutoCapitalize | null>(() => {
    if (this.autocapitalize()) return this.autocapitalize();
    const t = this.type();
    if (t === 'email' || t === 'password' || t === 'url' || t === 'tel') return 'off';
    return null;
  });

  readonly effectiveAutocorrect = computed<'on' | 'off' | null>(() => {
    if (this.autocorrect()) return this.autocorrect();
    const t = this.type();
    if (t === 'email' || t === 'password' || t === 'url' || t === 'tel') return 'off';
    return null;
  });

  /* spellcheck="false" además de autocorrect="off": en iOS 17+ el spell check
     activo hace que la QuickType bar (botón Contraseñas de AutoFill) se
     refresque y parpadee en cada tecla en campos de credenciales. */
  readonly effectiveSpellcheck = computed<boolean | null>(() => {
    if (this.spellcheck() !== null) return this.spellcheck();
    const t = this.type();
    if (t === 'email' || t === 'password' || t === 'url' || t === 'tel') return false;
    return null;
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngAfterViewInit(): void {
    if (this.pendingValue !== null) {
      const el = this.field()?.nativeElement;
      if (el) el.value = this.pendingValue;
      this.pendingValue = null;
    }
  }

  onInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
  }

  onBlur(): void {
    this.onTouched();
  }

  writeValue(value: string | number | null | undefined): void {
    const normalized = value == null ? '' : String(value);
    this.value.set(normalized);
    this.setDomValue(normalized);
  }

  private setDomValue(v: string): void {
    const el = this.field()?.nativeElement;
    if (!el) {
      this.pendingValue = v;
      return;
    }
    if (el.value !== v) el.value = v;
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
