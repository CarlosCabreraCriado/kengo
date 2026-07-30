import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

/**
 * Textarea V2 — mismo lenguaje visual que ui2-input.
 */
@Component({
  selector: 'ui2-textarea',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Ui2TextareaComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui2-textarea">
      @if (label()) {
        <label class="ui2-textarea__label" [attr.for]="textareaId">{{ label() }}@if (required()) {<span class="ui2-textarea__required" aria-hidden="true"> *</span>}</label>
      }
      <div
        class="ui2-textarea__shell"
        [class.ui2-textarea__shell--error]="!!error()"
        [class.ui2-textarea__shell--disabled]="disabled()"
      >
        <textarea
          #field
          [id]="textareaId"
          [placeholder]="placeholder()"
          [rows]="rows()"
          [readOnly]="readonly()"
          [disabled]="disabled()"
          [required]="required()"
          [attr.maxlength]="maxLength()"
          [attr.enterkeyhint]="enterkeyhint()"
          [attr.autocapitalize]="autocapitalize()"
          [attr.spellcheck]="spellcheck()"
          [attr.name]="name()"
          [style.resize]="resize()"
          (input)="onInput($event)"
          (blur)="onBlur()"
        ></textarea>
      </div>
      <div class="ui2-textarea__footer">
        <div class="ui2-textarea__msg" [class.ui2-textarea__msg--error]="!!error()">
          @if (error()) { {{ error() }} }
          @else if (hint()) { {{ hint() }} }
        </div>
        @if (showCount() && maxLength()) {
          <div class="ui2-textarea__count">{{ count() }}/{{ maxLength() }}</div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-textarea { display: flex; flex-direction: column; gap: 6px; }
    .ui2-textarea__label {
      font-family: Galvji, sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: var(--ink-700);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ui2-textarea__required { color: var(--danger); }
    .ui2-textarea__shell {
      background: var(--cream-50);
      border: 1px solid rgba(var(--kengo-primary-rgb), 0.6);
      border-radius: 14px;
      padding: 10px 14px;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .ui2-textarea__shell:focus-within {
      border-color: var(--kengo-primary);
      box-shadow: 0 0 0 3px rgba(var(--kengo-primary-rgb), 0.15);
      background: white;
    }
    .ui2-textarea__shell--error { border-color: var(--danger); }
    .ui2-textarea__shell--disabled { opacity: 0.6; }
    .ui2-textarea__shell textarea {
      width: 100%;
      border: 0;
      background: transparent;
      font-family: Galvji, sans-serif;
      font-size: 14px;
      color: var(--ink-900);
      outline: none;
      resize: vertical;
      line-height: 1.45;
    }
    .ui2-textarea__shell textarea::placeholder { color: var(--ink-400); }
    .ui2-textarea__footer {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 0 4px;
    }
    .ui2-textarea__msg {
      font-size: 11px;
      color: var(--ink-500);
      flex: 1;
    }
    .ui2-textarea__msg--error { color: var(--danger); font-weight: 600; }
    .ui2-textarea__count {
      font-size: 11px;
      color: var(--ink-400);
      font-variant-numeric: tabular-nums;
    }
  `],
})
export class Ui2TextareaComponent implements ControlValueAccessor, AfterViewInit {
  readonly label = input<string | null>(null);
  readonly placeholder = input<string>('');
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly required = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly rows = input<number>(4);
  readonly maxLength = input<number | null>(null);
  readonly showCount = input<boolean>(false);
  readonly resize = input<'none' | 'vertical' | 'horizontal' | 'both'>('vertical');
  readonly enterkeyhint = input<'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | null>(null);
  readonly autocapitalize = input<'off' | 'none' | 'sentences' | 'words' | 'characters' | null>(null);
  readonly spellcheck = input<boolean | null>(null);
  readonly name = input<string | null>(null);

  readonly textareaId = `ui2-textarea-${++nextId}`;
  /* Estado interno para la UI (count); nunca se bindea a [value] — reescribir
     el value del elemento enfocado en cada tecla resetea el estado de autofill
     de WKWebView y hace parpadear la QuickType bar en iOS. El DOM solo se
     escribe en writeValue() (cambios programáticos del modelo). */
  readonly value = signal<string>('');
  readonly disabled = signal<boolean>(false);
  readonly count = computed(() => this.value().length);

  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('field');
  private pendingValue: string | null = null;

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
    const v = (event.target as HTMLTextAreaElement).value;
    this.value.set(v);
    this.onChange(v);
  }
  onBlur(): void { this.onTouched(); }

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
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
}
