import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Exercise card V2 — card 120px ancho para el carrusel "Ejercicios de hoy".
 * Cabecera 80px con imagen real (`imageUrl`) o, en su defecto, gradiente coral-amarillo
 * con un Material Symbol centrado. Si `done`, gradient verde y badge check superpuesto.
 */
@Component({
  selector: 'ui2-exercise-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ui2-ex-card-host--fluid]': 'fluid()',
  },
  template: `
    <button
      type="button"
      class="ui2-ex-card"
      [class.ui2-ex-card--done]="done()"
      [class.ui2-ex-card--fluid]="fluid()"
      (click)="cardClick.emit($event)"
    >
      <span
        class="ui2-ex-card__head"
        [style.background]="headBackground()"
      >
        @if (imageUrl()) {
          <img class="ui2-ex-card__img" [src]="imageUrl()!" [alt]="name()" />
        } @else {
          <span class="material-symbols-outlined ui2-ex-card__icon" aria-hidden="true">
            {{ fallbackIcon() }}
          </span>
        }
      </span>
      <span class="ui2-ex-card__body">
        <span class="ui2-ex-card__name">{{ name() }}</span>
        <span class="ui2-ex-card__sets">{{ sets() }}</span>
      </span>
      @if (done()) {
        <span class="ui2-ex-card__badge" aria-label="Completado">
          <span class="material-symbols-outlined" aria-hidden="true">check</span>
        </span>
      }
    </button>
  `,
  styles: [`
    :host { display: inline-block; flex-shrink: 0; }
    :host(.ui2-ex-card-host--fluid) { display: block; width: 100%; }
    .ui2-ex-card {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 120px;
      padding: 0;
      border: 1px solid rgba(0, 0, 0, 0.04);
      border-radius: 18px;
      background: white;
      overflow: hidden;
      box-shadow: var(--shadow-card);
      cursor: pointer;
      text-align: left;
      font: inherit;
      color: inherit;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .ui2-ex-card--fluid { width: 100%; }
    .ui2-ex-card:active { transform: translateY(1px); }
    .ui2-ex-card--done {
      background: rgba(34, 197, 94, 0.08);
      border-color: rgba(34, 197, 94, 0.2);
      box-shadow: none;
    }
    .ui2-ex-card__head {
      display: grid;
      place-items: center;
      height: 80px;
      width: 100%;
      overflow: hidden;
    }
    .ui2-ex-card__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .ui2-ex-card__icon {
      font-size: 36px;
      color: var(--kengo-primary);
      opacity: 0.7;
    }
    .ui2-ex-card--done .ui2-ex-card__icon { color: #16a34a; opacity: 0.85; }
    .ui2-ex-card__body { padding: 10px 12px; display: block; }
    .ui2-ex-card__name {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: var(--ink-900);
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ui2-ex-card__sets {
      display: block;
      font-size: 10px;
      color: var(--ink-500);
      margin-top: 3px;
    }
    .ui2-ex-card__badge {
      position: absolute;
      top: 8px;
      right: 8px;
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #22c55e;
      color: white;
      box-shadow: 0 2px 6px rgba(34, 197, 94, 0.4);
    }
    .ui2-ex-card__badge .material-symbols-outlined {
      font-size: 14px;
      font-variation-settings: 'FILL' 1, 'wght' 700;
    }
  `],
})
export class Ui2ExerciseCardComponent {
  readonly name = input.required<string>();
  readonly sets = input<string>('');
  readonly imageUrl = input<string | null>(null);
  readonly fallbackIcon = input<string>('fitness_center');
  readonly done = input<boolean>(false);
  readonly index = input<number>(0);
  readonly fluid = input<boolean>(false);

  readonly cardClick = output<MouseEvent>();

  readonly headBackground = computed(() => {
    if (this.imageUrl()) return 'transparent';
    if (this.done()) {
      return 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.06))';
    }
    const base = Math.max(0.05, 0.18 - this.index() * 0.02);
    return `linear-gradient(135deg, rgba(var(--kengo-primary-rgb),${base}), rgba(239,192,72,${base}))`;
  });
}
