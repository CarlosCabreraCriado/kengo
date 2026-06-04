import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

let collapsibleCounter = 0;

/**
 * Acordeón genérico V2 — header con título + chevron + body animado por max-height.
 * Reutilizable como contenedor colapsable en pantallas (móvil acordeones, paneles, FAQ, etc.).
 */
@Component({
  selector: 'ui2-collapsible',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ui2-coll" [class.ui2-coll--open]="isOpen()">
      <button
        type="button"
        class="ui2-coll__head"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-controls]="bodyId"
        [disabled]="disabled()"
        (click)="toggle()"
      >
        <div class="ui2-coll__head-text">
          <span class="ui2-coll__title">{{ title() }}</span>
          @if (subtitle()) {
            <span class="ui2-coll__subtitle">{{ subtitle() }}</span>
          }
        </div>
        @if (count() !== null && count()! > 0) {
          <span class="ui2-coll__count" aria-hidden="true">{{ count() }}</span>
        }
        <span
          class="material-symbols-outlined ui2-coll__chev"
          [class.ui2-coll__chev--open]="isOpen()"
          aria-hidden="true"
        >expand_more</span>
      </button>
      <div
        class="ui2-coll__body"
        [id]="bodyId"
        [attr.aria-hidden]="!isOpen()"
        [style.max-height.px]="isOpen() ? contentHeight() : 0"
      >
        <div class="ui2-coll__inner" #inner>
          <ng-content></ng-content>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .ui2-coll {
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.04);
        border-radius: 22px;
        box-shadow: var(--shadow-card);
        overflow: hidden;
      }
      .ui2-coll__head {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 14px 16px;
        border: 0;
        background: transparent;
        font: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }
      .ui2-coll__head:disabled {
        cursor: default;
        opacity: 0.6;
      }
      .ui2-coll__head-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .ui2-coll__title {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: var(--ink-900);
        line-height: 1.1;
      }
      .ui2-coll__subtitle {
        font-size: 11px;
        color: var(--ink-500);
        line-height: 1.3;
      }
      .ui2-coll__count {
        font-size: 10px;
        font-weight: 700;
        color: var(--ink-500);
        background: rgba(0, 0, 0, 0.04);
        padding: 3px 8px;
        border-radius: 9999px;
        min-width: 18px;
        text-align: center;
      }
      .ui2-coll__chev {
        font-size: 22px;
        color: var(--ink-500);
        background: rgba(0, 0, 0, 0.04);
        border-radius: 9999px;
        padding: 4px;
        transition: transform 360ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .ui2-coll__chev--open {
        transform: rotate(180deg);
      }
      .ui2-coll__body {
        max-height: 0;
        overflow: hidden;
        transition: max-height 380ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .ui2-coll__inner {
        padding: 0 14px 14px;
        border-top: 1px solid rgba(0, 0, 0, 0.04);
        padding-top: 12px;
        opacity: 0;
        transform: translateY(-4px);
        transition:
          opacity 240ms cubic-bezier(0.4, 0, 0.2, 1),
          transform 320ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .ui2-coll--open .ui2-coll__inner {
        opacity: 1;
        transform: translateY(0);
        transition-delay: 80ms;
      }
      @media (prefers-reduced-motion: reduce) {
        .ui2-coll__body,
        .ui2-coll__inner,
        .ui2-coll__chev {
          transition: none;
        }
      }
    `,
  ],
})
export class Ui2CollapsibleComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly count = input<number | null>(null);
  readonly defaultOpen = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly openChange = output<boolean>();

  readonly bodyId = `ui2-coll-body-${++collapsibleCounter}`;
  private readonly _open = signal<boolean>(false);
  readonly isOpen = computed(() => this._open());
  readonly contentHeight = signal<number>(0);

  private readonly destroyRef = inject(DestroyRef);
  private readonly innerRef = viewChild<ElementRef<HTMLDivElement>>('inner');
  private resizeObserver?: ResizeObserver;

  constructor() {
    effect(
      () => {
        this._open.set(this.defaultOpen());
      },
      { allowSignalWrites: true },
    );

    effect(() => {
      const el = this.innerRef()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;

      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => {
        this.contentHeight.set(el.scrollHeight);
      });
      this.resizeObserver.observe(el);
      this.contentHeight.set(el.scrollHeight);
    });

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
    });
  }

  toggle(): void {
    if (this.disabled()) return;
    const next = !this._open();
    this._open.set(next);
    this.openChange.emit(next);
  }
}
