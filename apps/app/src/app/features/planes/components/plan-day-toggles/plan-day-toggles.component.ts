import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DiaSemana } from '../../../../../types/global';

const DIAS: readonly DiaSemana[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const NOMBRES: Record<DiaSemana, string> = {
  L: 'Lunes',
  M: 'Martes',
  X: 'Miércoles',
  J: 'Jueves',
  V: 'Viernes',
  S: 'Sábado',
  D: 'Domingo',
};

/**
 * Toggles de los 7 días de la semana (L M X J V S D).
 * Two-way: emite el array completo en `valueChange` cada vez que cambia.
 */
@Component({
  selector: 'app-plan-day-toggles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pdt" role="group" [attr.aria-label]="'Días de la semana'">
      @for (d of all; track d) {
        <button
          type="button"
          class="pdt__btn"
          [class.pdt__btn--active]="active().has(d)"
          [attr.aria-pressed]="active().has(d) ? 'true' : 'false'"
          [attr.aria-label]="nombres[d]"
          (click)="toggle(d)"
        >{{ d }}</button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pdt {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .pdt__btn {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 10px;
      background: white;
      color: var(--ink-400);
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.2px;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }
    .pdt__btn:hover:not(.pdt__btn--active) {
      border-color: rgba(var(--kengo-primary-rgb), 0.4);
      color: var(--ink-700);
    }
    .pdt__btn--active {
      background: var(--kengo-primary);
      border-color: var(--kengo-primary);
      color: white;
      box-shadow: 0 4px 8px -2px rgba(var(--kengo-primary-rgb), 0.4);
    }
  `],
})
export class PlanDayTogglesComponent {
  readonly value = input<DiaSemana[] | null>(null);
  readonly valueChange = output<DiaSemana[]>();

  readonly all = DIAS;
  readonly nombres = NOMBRES;
  readonly active = computed(() => new Set(this.value() ?? []));

  toggle(d: DiaSemana): void {
    const set = new Set(this.value() ?? []);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    const ordered = DIAS.filter((day) => set.has(day));
    this.valueChange.emit(ordered);
  }
}
