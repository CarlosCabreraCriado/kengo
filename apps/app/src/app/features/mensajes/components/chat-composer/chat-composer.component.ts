import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-chat-composer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="composer"
      [class.composer--disabled]="disabled()"
      (submit)="onSubmit($event)"
    >
      <input
        class="composer__input"
        type="text"
        enterkeyhint="send"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="text()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (keydown.enter)="onSubmit($event)"
        aria-label="Escribir un mensaje"
      />
      <button
        type="submit"
        class="composer__send"
        [disabled]="!canSend()"
        aria-label="Enviar mensaje"
      >
        <span class="material-symbols-outlined" aria-hidden="true"
          >arrow_forward</span
        >
      </button>
    </form>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 12px 18px 18px;
        border-top: 1px solid rgba(0, 0, 0, 0.04);
      }
      .composer {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 6px 6px 16px;
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.06);
        border-radius: 16px;
      }
      .composer:focus-within {
        border-color: rgba(var(--kengo-primary-rgb), 0.3);
        box-shadow: 0 0 0 3px rgba(var(--kengo-primary-rgb), 0.1);
      }
      .composer--disabled {
        opacity: 0.6;
        pointer-events: none;
      }
      .composer__input {
        flex: 1;
        min-width: 0;
        border: 0;
        background: transparent;
        font-family: Galvji, 'Helvetica Neue', sans-serif;
        font-size: 14px;
        color: var(--ink-900);
        padding: 8px 0;
        outline: none;
      }
      .composer__input::placeholder {
        color: var(--ink-400);
      }
      .composer__send {
        width: 38px;
        height: 38px;
        flex-shrink: 0;
        border-radius: 50%;
        border: 0;
        background: linear-gradient(
          135deg,
          var(--kengo-primary),
          var(--kengo-primary-dark)
        );
        color: white;
        cursor: pointer;
        display: grid;
        place-items: center;
        box-shadow: var(--shadow-pill-coral);
        transition:
          transform 0.1s,
          filter 0.15s;
      }
      .composer__send:hover:not(:disabled) {
        filter: brightness(1.05);
      }
      .composer__send:active:not(:disabled) {
        transform: translateY(1px);
      }
      .composer__send:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        box-shadow: none;
      }
      .composer__send .material-symbols-outlined {
        font-size: 22px;
        font-weight: 700;
      }
    `,
  ],
})
export class ChatComposerComponent {
  readonly placeholder = input<string>('Escribe un mensaje…');
  readonly disabled = input<boolean>(false);
  readonly send = output<string>();

  readonly text = signal<string>('');

  onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }

  canSend(): boolean {
    return !this.disabled() && this.text().trim().length > 0;
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSend()) return;
    this.send.emit(this.text().trim());
    this.text.set('');
    const target = event.target as HTMLElement;
    const input = target.querySelector(
      'input.composer__input',
    ) as HTMLInputElement | null;
    if (input) input.value = '';
  }
}
