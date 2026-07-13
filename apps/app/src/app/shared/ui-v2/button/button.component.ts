import { ChangeDetectionStrategy, Component, computed, HostBinding, input, output } from '@angular/core';

export type Ui2ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type Ui2ButtonSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<Ui2ButtonSize, string> = {
  sm: 'ui2-btn--sm',
  md: 'ui2-btn--md',
  lg: 'ui2-btn--lg',
};

const VARIANT_CLASS: Record<Ui2ButtonVariant, string> = {
  primary: 'ui2-btn--primary',
  secondary: 'ui2-btn--secondary',
  ghost: 'ui2-btn--ghost',
  danger: 'ui2-btn--danger',
};

/**
 * Button V2 — primary con coral gradient + sombra coral; secondary cream; ghost transparente; danger rojo.
 * Radio 14px (sm/md) o 18px (lg). Soporta iconos Material a izq/der y estado loading.
 */
@Component({
  selector: 'ui2-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="classes()"
      (click)="onClick($event)"
    >
      @if (loading()) {
        <span class="ui2-btn__spinner"></span>
      }
      @if (iconLeft() && !loading()) {
        <span class="material-symbols-outlined ui2-btn__icon" aria-hidden="true">{{ iconLeft() }}</span>
      }
      <span class="ui2-btn__content" [class.ui2-btn__content--invisible]="loading() && !iconOnly()">
        <ng-content></ng-content>
      </span>
      @if (iconRight() && !loading()) {
        <span class="material-symbols-outlined ui2-btn__icon" aria-hidden="true">{{ iconRight() }}</span>
      }
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    :host(.ui2-btn--full-width) { display: block; width: 100%; }
    :host(.ui2-btn--full-width) button { width: 100%; }

    .ui2-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: Galvji, "Helvetica Neue", sans-serif;
      font-weight: 700;
      letter-spacing: 0.1px;
      border: 0;
      cursor: pointer;
      transition: transform 0.1s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease;
      line-height: 1;
    }
    .ui2-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .ui2-btn:active:not(:disabled) { transform: translateY(1px); }
    .ui2-btn:focus-visible { outline: 2px solid var(--kengo-primary); outline-offset: 2px; }

    .ui2-btn--sm { padding: 8px 14px; border-radius: 14px; font-size: 13px; }
    .ui2-btn--md { padding: 12px 18px; border-radius: 14px; font-size: 14px; }
    .ui2-btn--lg { padding: 16px 22px; border-radius: 18px; font-size: 16px; }
    .ui2-btn--icon-only.ui2-btn--sm { padding: 8px; }
    .ui2-btn--icon-only.ui2-btn--md { padding: 12px; }
    .ui2-btn--icon-only.ui2-btn--lg { padding: 16px; }

    .ui2-btn--primary {
      background: linear-gradient(135deg, var(--kengo-primary), var(--kengo-primary-dark));
      color: white;
      box-shadow: var(--shadow-cta-coral);
    }
    .ui2-btn--primary:hover:not(:disabled) { filter: brightness(1.04); }

    .ui2-btn--secondary {
      background: var(--cream-50);
      color: var(--ink-900);
      box-shadow: 0 1px 0 var(--ink-100);
      border: 1px solid var(--ink-100);
    }
    .ui2-btn--secondary:hover:not(:disabled) { background: var(--cream-100); }

    .ui2-btn--ghost {
      background: transparent;
      color: var(--ink-700);
    }
    .ui2-btn--ghost:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }

    .ui2-btn--danger {
      background: var(--danger);
      color: white;
      box-shadow: 0 8px 20px -6px rgba(239, 68, 68, 0.5);
    }
    .ui2-btn--danger:hover:not(:disabled) { filter: brightness(1.05); }

    .ui2-btn__icon { font-size: 1.2em; line-height: 1; }
    .ui2-btn__content { display: inline-flex; align-items: center; gap: 6px; }
    .ui2-btn__content--invisible { opacity: 0; }
    /* En icon-only el contenido proyectado es solo etiqueta accesible: se saca
       del flujo flex para que el icono quede perfectamente centrado (sin el gap). */
    .ui2-btn--icon-only .ui2-btn__content {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .ui2-btn__spinner {
      position: absolute;
      width: 1.1em;
      height: 1.1em;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: ui2-btn-spin 0.6s linear infinite;
    }
    @keyframes ui2-btn-spin { to { transform: rotate(360deg); } }
  `],
})
export class Ui2ButtonComponent {
  readonly variant = input<Ui2ButtonVariant>('primary');
  readonly size = input<Ui2ButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly iconLeft = input<string | null>(null);
  readonly iconRight = input<string | null>(null);
  readonly iconOnly = input<boolean>(false);
  readonly fullWidth = input<boolean>(false);
  readonly clicked = output<MouseEvent>();

  @HostBinding('class.ui2-btn--full-width') get hostFullWidth() {
    return this.fullWidth();
  }

  readonly classes = computed(() => {
    const cls = ['ui2-btn', SIZE_CLASS[this.size()], VARIANT_CLASS[this.variant()]];
    if (this.iconOnly()) cls.push('ui2-btn--icon-only');
    return cls.join(' ');
  });

  onClick(event: MouseEvent): void {
    if (!this.disabled() && !this.loading()) {
      this.clicked.emit(event);
    }
  }
}
