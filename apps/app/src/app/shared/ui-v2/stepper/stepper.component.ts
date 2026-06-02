import {
  AfterContentInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type Ui2StepperOrientation = 'horizontal' | 'vertical';

/**
 * Step individual del stepper V2. Renderiza su `<ng-content>` cuando está activo.
 *
 * ```html
 * <ui2-stepper [selectedIndex]="step()">
 *   <ui2-step label="Datos">...</ui2-step>
 *   <ui2-step label="Confirmar">...</ui2-step>
 * </ui2-stepper>
 * ```
 */
@Component({
  selector: 'ui2-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isActive()) {
      <div class="ui2-step__content">
        <ng-content></ng-content>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .ui2-step__content {
      animation: ui2-step-in 0.2s ease-out;
    }
    @keyframes ui2-step-in {
      from { opacity: 0; transform: translateX(8px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `],
})
export class Ui2StepComponent {
  @Input() label = '';
  @Input() optional = false;
  @Input() completed = false;
  @Input() editable = true;

  readonly isActive = signal(false);
}

/**
 * Stepper V2 — pills coral activas, ink-300 inactivas, check verde para completadas.
 * Soporta orientación horizontal (default) y vertical.
 */
@Component({
  selector: 'ui2-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-stepper" [class.ui2-stepper--vertical]="orientation === 'vertical'">
      <div
        class="ui2-stepper__header-wrap"
        [class.ui2-stepper__header-wrap--scroll-start]="showHints() && canScrollStart()"
        [class.ui2-stepper__header-wrap--scroll-end]="showHints() && canScrollEnd()"
      >
        <div
          #headerEl
          class="ui2-stepper__header"
          [class.ui2-stepper__header--vertical]="orientation === 'vertical'"
        >
          <!-- $index estable: proyección de <ng-content>, el orden es la propia identidad del step -->
          @for (step of steps; track $index; let i = $index; let isLast = $last) {
            <button
              type="button"
              class="ui2-stepper__step"
              [class.ui2-stepper__step--active]="i === selectedIndex"
              [class.ui2-stepper__step--completed]="step.completed || i < selectedIndex"
              [class.ui2-stepper__step--clickable]="canClick(i, step)"
              [disabled]="!canClick(i, step)"
              (click)="onStepClick(i, step)"
            >
              <span class="ui2-stepper__indicator">
                @if (step.completed || i < selectedIndex) {
                  <span class="material-symbols-outlined" aria-hidden="true">check</span>
                } @else {
                  {{ i + 1 }}
                }
              </span>
              <span class="ui2-stepper__label">
                <span class="ui2-stepper__label-text">{{ step.label }}</span>
                @if (step.optional) {
                  <span class="ui2-stepper__optional">Opcional</span>
                }
              </span>
            </button>
            @if (!isLast) {
              <span
                class="ui2-stepper__connector"
                [class.ui2-stepper__connector--completed]="i < selectedIndex"
              ></span>
            }
          }
        </div>
        @if (showHints()) {
          <span class="ui2-stepper__scroll-hint ui2-stepper__scroll-hint--start" aria-hidden="true">
            <span class="material-symbols-outlined">chevron_left</span>
          </span>
          <span class="ui2-stepper__scroll-hint ui2-stepper__scroll-hint--end" aria-hidden="true">
            <span class="material-symbols-outlined">chevron_right</span>
          </span>
        }
      </div>

      <div class="ui2-stepper__content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-stepper { display: flex; flex-direction: column; }
    .ui2-stepper--vertical { flex-direction: row; }

    .ui2-stepper__header-wrap {
      position: relative;
      margin-bottom: 20px;
    }
    .ui2-stepper__header {
      display: flex;
      align-items: center;
      gap: 4px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .ui2-stepper__header::-webkit-scrollbar { display: none; }
    .ui2-stepper__header--vertical {
      flex-direction: column;
      align-items: flex-start;
      margin: 0 24px 0 0;
      overflow-x: visible;
    }

    .ui2-stepper__scroll-hint {
      position: absolute;
      top: 0;
      bottom: 4px;
      width: 36px;
      display: inline-flex;
      align-items: center;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.18s ease-out;
      color: var(--kengo-primary);
    }
    .ui2-stepper__scroll-hint .material-symbols-outlined {
      font-size: 20px;
      font-variation-settings: "FILL" 1;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.08));
      animation: ui2-stepper-hint-pulse 1.6s ease-in-out infinite;
    }
    .ui2-stepper__scroll-hint--start {
      left: 0;
      justify-content: flex-start;
      background: linear-gradient(
        to right,
        var(--ui2-stepper-bg, white) 35%,
        rgba(255, 255, 255, 0)
      );
    }
    .ui2-stepper__scroll-hint--end {
      right: 0;
      justify-content: flex-end;
      background: linear-gradient(
        to left,
        var(--ui2-stepper-bg, white) 35%,
        rgba(255, 255, 255, 0)
      );
    }
    .ui2-stepper__header-wrap--scroll-start .ui2-stepper__scroll-hint--start { opacity: 1; }
    .ui2-stepper__header-wrap--scroll-end .ui2-stepper__scroll-hint--end { opacity: 1; }

    @keyframes ui2-stepper-hint-pulse {
      0%, 100% { transform: translateX(0); opacity: 0.65; }
      50% { transform: translateX(2px); opacity: 1; }
    }
    .ui2-stepper__scroll-hint--start .material-symbols-outlined {
      animation-name: ui2-stepper-hint-pulse-rev;
    }
    @keyframes ui2-stepper-hint-pulse-rev {
      0%, 100% { transform: translateX(0); opacity: 0.65; }
      50% { transform: translateX(-2px); opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .ui2-stepper__scroll-hint .material-symbols-outlined { animation: none; }
      .ui2-stepper__scroll-hint { transition: none; }
    }

    .ui2-stepper__step {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      padding: 6px 4px;
      border: 0;
      background: transparent;
      font-family: Galvji, sans-serif;
      cursor: not-allowed;
    }
    .ui2-stepper__step--clickable { cursor: pointer; }

    .ui2-stepper__indicator {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 9999px;
      background: var(--ink-100);
      color: var(--ink-500);
      font-size: 13px;
      font-weight: 700;
      transition: background 0.2s, color 0.2s, box-shadow 0.2s;
      flex-shrink: 0;
    }
    .ui2-stepper__step--active .ui2-stepper__indicator {
      background: var(--kengo-primary);
      color: white;
      box-shadow: var(--shadow-pill-coral);
    }
    .ui2-stepper__step--completed .ui2-stepper__indicator {
      background: var(--success);
      color: white;
    }
    .ui2-stepper__indicator .material-symbols-outlined { font-size: 18px; }

    .ui2-stepper__label {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.2;
    }
    .ui2-stepper__label-text {
      font-size: 13px;
      font-weight: 600;
      color: var(--ink-700);
      white-space: nowrap;
    }
    .ui2-stepper__step--active .ui2-stepper__label-text { color: var(--kengo-primary); }
    .ui2-stepper__optional {
      font-size: 11px;
      color: var(--ink-400);
      margin-top: 1px;
    }

    .ui2-stepper__connector {
      flex: 1;
      min-width: 16px;
      height: 2px;
      background: var(--ink-100);
      border-radius: 1px;
      align-self: center;
      transition: background 0.2s;
    }
    .ui2-stepper__connector--completed { background: var(--success); }

    .ui2-stepper--vertical .ui2-stepper__connector {
      width: 2px;
      height: 24px;
      min-width: 2px;
      margin-left: 13px;
      align-self: flex-start;
    }

    .ui2-stepper__content { flex: 1; }
  `],
})
export class Ui2StepperComponent
  implements AfterContentInit, AfterViewInit, OnChanges, OnDestroy
{
  @ContentChildren(Ui2StepComponent) stepsQuery!: QueryList<Ui2StepComponent>;
  @ViewChild('headerEl') headerEl?: ElementRef<HTMLDivElement>;

  @Input() selectedIndex = 0;
  @Input() orientation: Ui2StepperOrientation = 'horizontal';
  @Input() linear = false;

  @Output() selectedIndexChange = new EventEmitter<number>();
  @Output() selectionChange = new EventEmitter<{ selectedIndex: number; previousIndex: number }>();

  steps: Ui2StepComponent[] = [];

  readonly canScrollStart = signal(false);
  readonly canScrollEnd = signal(false);
  readonly showHints = computed(() => this.orientation === 'horizontal');

  private readonly zone = inject(NgZone);
  private resizeObserver?: ResizeObserver;
  private readonly scrollHandler = () => this.updateScrollHints();
  private readonly destroyRef = inject(DestroyRef);

  ngAfterContentInit(): void {
    this.steps = this.stepsQuery.toArray();
    this.refreshSteps();
    this.stepsQuery.changes
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.steps = this.stepsQuery.toArray();
        this.refreshSteps();
        // Tras añadir/quitar pasos el ancho del header cambia.
        this.scheduleHintUpdate();
      });
  }

  ngAfterViewInit(): void {
    const el = this.headerEl?.nativeElement;
    if (!el || !this.showHints()) return;

    this.zone.runOutsideAngular(() => {
      el.addEventListener('scroll', this.scrollHandler, { passive: true });
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.updateScrollHints());
        this.resizeObserver.observe(el);
      }
    });
    this.scheduleHintUpdate();
  }

  // Sin esto, cambios externos del input `selectedIndex` actualizan el header
  // (que bindea la expresión directamente) pero no el signal `isActive` de
  // cada `<ui2-step>`, dejando el contenido fijo en el paso inicial.
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedIndex'] && this.steps.length > 0) {
      this.refreshSteps();
    }
  }

  ngOnDestroy(): void {
    this.headerEl?.nativeElement.removeEventListener('scroll', this.scrollHandler);
    this.resizeObserver?.disconnect();
  }

  private scheduleHintUpdate(): void {
    // Esperar a que el navegador haya pintado los nuevos steps antes de medir.
    if (typeof requestAnimationFrame === 'undefined') {
      this.updateScrollHints();
      return;
    }
    requestAnimationFrame(() => this.updateScrollHints());
  }

  private updateScrollHints(): void {
    const el = this.headerEl?.nativeElement;
    if (!el || !this.showHints()) {
      this.canScrollStart.set(false);
      this.canScrollEnd.set(false);
      return;
    }
    // Tolerancia de 2px para evitar flicker en sub-pixel rendering.
    const start = el.scrollLeft > 2;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    this.canScrollStart.set(start);
    this.canScrollEnd.set(end);
  }

  canClick(index: number, step: Ui2StepComponent): boolean {
    if (this.linear && index > this.selectedIndex) return false;
    if (!step.editable && index < this.selectedIndex) return false;
    return index !== this.selectedIndex;
  }

  onStepClick(index: number, step: Ui2StepComponent): void {
    if (!this.canClick(index, step)) return;
    this.goToStep(index);
  }

  goToStep(index: number): void {
    if (index < 0 || index >= this.steps.length || index === this.selectedIndex) return;
    const previousIndex = this.selectedIndex;
    this.selectedIndex = index;
    this.refreshSteps();
    this.scheduleHintUpdate();
    this.selectedIndexChange.emit(this.selectedIndex);
    this.selectionChange.emit({ selectedIndex: this.selectedIndex, previousIndex });
  }

  next(): void { this.goToStep(this.selectedIndex + 1); }
  previous(): void { this.goToStep(this.selectedIndex - 1); }
  reset(): void {
    this.steps.forEach((s) => (s.completed = false));
    this.goToStep(0);
  }

  private refreshSteps(): void {
    this.steps.forEach((step, i) => step.isActive.set(i === this.selectedIndex));
  }
}
