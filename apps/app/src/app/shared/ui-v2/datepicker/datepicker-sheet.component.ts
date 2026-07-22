import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import {
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
} from '../dialog/dialog.component';
import { getMadridDate } from '../../utils/madrid-date.util';
import {
  addMonths,
  buildMonthGrid,
  daysInMonth,
  MESES_ES,
  monthLabel,
  monthOf,
  WEEKDAYS_LMD,
  type Ui2DatepickerDay,
  type Ui2DatepickerSheetData,
} from './datepicker.types';

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/**
 * Contenido del bottom-sheet de `ui2-datepicker`: un calendario mensual propio.
 *
 * NO usa el `<input type="date">` nativo del sistema (cuyo picker es poco
 * fiable en WKWebView/Android WebView). Se abre con `DialogService.openSheet`
 * y devuelve el 'yyyy-mm-dd' elegido vía `DialogRef.close(ymd)`; cerrar sin
 * elegir (X, backdrop, ESC, atrás Android) resuelve `undefined` y no muta nada.
 *
 * Detalle interno del datepicker — no se exporta en el barrel de ui-v2.
 */
@Component({
  selector: 'ui2-datepicker-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
  ],
  template: `
    <ui2-dialog-host variant="sheet">
      <ui2-dialog-header title="Selecciona fecha" (closeClick)="cancelar()"></ui2-dialog-header>

      <ui2-dialog-content>
        <div class="dp-cal">
          <div class="dp-cal__nav">
            <button
              type="button"
              class="dp-cal__nav-btn"
              [disabled]="prevDisabled()"
              (click)="prevMonth()"
              aria-label="Mes anterior"
            >
              <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
            </button>
            <span class="dp-cal__month" aria-live="polite">{{ monthTitle() }}</span>
            <button
              type="button"
              class="dp-cal__nav-btn"
              [disabled]="nextDisabled()"
              (click)="nextMonth()"
              aria-label="Mes siguiente"
            >
              <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </button>
          </div>

          <div class="dp-cal__weekdays" aria-hidden="true">
            @for (wd of weekdays; track wd) {
              <span class="dp-cal__weekday">{{ wd }}</span>
            }
          </div>

          <div class="dp-cal__grid" role="grid">
            @for (week of weeks(); track week[0].ymd) {
              <div class="dp-cal__week" role="row">
                @for (day of week; track day.ymd) {
                  <button
                    type="button"
                    role="gridcell"
                    class="dp-cal__day"
                    [class.dp-cal__day--muted]="!day.inMonth"
                    [class.dp-cal__day--today]="day.isToday"
                    [class.dp-cal__day--selected]="day.isSelected"
                    [disabled]="day.disabled"
                    [attr.aria-label]="ariaLabel(day)"
                    [attr.aria-current]="day.isToday ? 'date' : null"
                    [attr.aria-pressed]="day.isSelected"
                    (click)="seleccionar(day)"
                  >{{ day.day }}</button>
                }
              </div>
            }
          </div>
        </div>
      </ui2-dialog-content>
    </ui2-dialog-host>
  `,
  styles: [`
    :host { display: block; }
    .dp-cal { display: flex; flex-direction: column; gap: 12px; }

    .dp-cal__nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .dp-cal__nav-btn {
      display: inline-grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 9999px;
      border: 0;
      background: var(--cream-50);
      color: var(--ink-700);
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }
    .dp-cal__nav-btn:hover:not(:disabled) { background: var(--cream-100); }
    .dp-cal__nav-btn:active:not(:disabled) { transform: translateY(1px); }
    .dp-cal__nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .dp-cal__nav-btn .material-symbols-outlined { font-size: 22px; }
    .dp-cal__month {
      flex: 1;
      text-align: center;
      font-family: KengoDisplay, Galvji, sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: var(--ink-900);
      letter-spacing: -0.2px;
      text-transform: capitalize;
    }

    .dp-cal__weekdays,
    .dp-cal__week {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .dp-cal__weekday {
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: var(--ink-400);
      text-transform: uppercase;
    }

    .dp-cal__grid { display: flex; flex-direction: column; gap: 4px; }

    .dp-cal__day {
      aspect-ratio: 1;
      display: inline-grid;
      place-items: center;
      width: 100%;
      border: 1px solid transparent;
      border-radius: 9999px;
      background: transparent;
      font-family: Galvji, sans-serif;
      font-size: 14px;
      color: var(--ink-900);
      cursor: pointer;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
    }
    .dp-cal__day:hover:not(:disabled):not(.dp-cal__day--selected) {
      background: var(--cream-100);
    }
    .dp-cal__day--muted { color: var(--ink-300); }
    .dp-cal__day--today {
      border-color: var(--kengo-primary);
      font-weight: 700;
    }
    .dp-cal__day--selected {
      background: var(--kengo-primary);
      border-color: var(--kengo-primary);
      color: white;
      font-weight: 700;
      box-shadow: var(--shadow-pill-coral);
    }
    .dp-cal__day:disabled {
      color: var(--ink-300);
      cursor: not-allowed;
      opacity: 0.55;
    }
  `],
})
export class Ui2DatepickerSheetComponent {
  private dialogRef = inject(DialogRef<string, Ui2DatepickerSheetComponent>);
  private data = inject<Ui2DatepickerSheetData>(DIALOG_DATA);

  private readonly today = getMadridDate();
  readonly weekdays = WEEKDAYS_LMD;

  /** Mes visible; arranca en el mes del valor o, si no hay, en el mes actual. */
  private readonly view = signal<{ y: number; m: number }>(
    monthOf(this.data.value ?? this.today),
  );

  readonly monthTitle = computed(() => monthLabel(this.view().y, this.view().m));

  readonly weeks = computed<Ui2DatepickerDay[][]>(() =>
    buildMonthGrid(this.view().y, this.view().m, {
      value: this.data.value,
      min: this.data.min,
      max: this.data.max,
      today: this.today,
    }),
  );

  /** Deshabilita "‹" si el mes anterior queda íntegramente por debajo de `min`. */
  readonly prevDisabled = computed(() => {
    const min = this.data.min;
    if (!min) return false;
    const prev = addMonths(this.view().y, this.view().m, -1);
    const lastDayPrev = `${prev.y}-${pad2(prev.m)}-${pad2(daysInMonth(prev.y, prev.m))}`;
    return lastDayPrev < min;
  });

  /** Deshabilita "›" si el mes siguiente queda íntegramente por encima de `max`. */
  readonly nextDisabled = computed(() => {
    const max = this.data.max;
    if (!max) return false;
    const next = addMonths(this.view().y, this.view().m, 1);
    const firstDayNext = `${next.y}-${pad2(next.m)}-01`;
    return firstDayNext > max;
  });

  prevMonth(): void {
    this.view.set(addMonths(this.view().y, this.view().m, -1));
  }

  nextMonth(): void {
    this.view.set(addMonths(this.view().y, this.view().m, 1));
  }

  seleccionar(day: Ui2DatepickerDay): void {
    if (day.disabled) return;
    this.dialogRef.close(day.ymd);
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  ariaLabel(day: Ui2DatepickerDay): string {
    const { y, m } = monthOf(day.ymd);
    return `${day.day} de ${MESES_ES[m - 1]} de ${y}`;
  }
}
