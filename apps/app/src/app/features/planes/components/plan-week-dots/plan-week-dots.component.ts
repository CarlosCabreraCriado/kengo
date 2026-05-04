import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DiaSemana } from '../../../../../types/global';

const DIAS: readonly DiaSemana[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Chips de los 7 días de la semana (L M X J V S D) en modo lectura.
 * Resalta en coral los días incluidos en `dias`.
 */
@Component({
  selector: 'app-plan-week-dots',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pwd" role="list" [attr.aria-label]="'Días de la semana activos'">
      @for (d of all; track d) {
        <span
          class="pwd__chip"
          role="listitem"
          [class.pwd__chip--active]="active().has(d)"
        >{{ d }}</span>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pwd {
      display: flex;
      gap: 5px;
    }
    .pwd__chip {
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      background: rgba(0, 0, 0, 0.04);
      color: var(--ink-400);
      letter-spacing: 0.2px;
    }
    .pwd__chip--active {
      background: var(--kengo-primary);
      color: white;
      box-shadow: 0 3px 6px -2px rgba(var(--kengo-primary-rgb), 0.4);
    }
  `],
})
export class PlanWeekDotsComponent {
  readonly dias = input<DiaSemana[] | null>(null);
  readonly all = DIAS;
  readonly active = computed(() => new Set(this.dias() ?? []));
}
