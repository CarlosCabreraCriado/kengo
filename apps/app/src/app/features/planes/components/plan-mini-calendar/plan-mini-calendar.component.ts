import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DiaSemana } from '../../../../../types/global';
import {
  daysBetweenYMD,
  diaSemanaFromYMD,
  getMadridDate,
  ymdToDateForDisplay,
} from '../../../../shared/utils/madrid-date.util';

interface CalCell {
  ymd: string;
  day: number;
  inMonth: boolean;
  isStart: boolean;
  isEnd: boolean;
  isSession: boolean;
  isToday: boolean;
}

const DOW_LABELS: readonly string[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const MONTH_NAMES: readonly string[] = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Mini calendario mensual (lectura) para el detalle del plan.
 * Resalta inicio (coral), fin (terciario) y los días de sesión activos
 * dentro del rango del plan (tint coral).
 */
@Component({
  selector: 'app-plan-mini-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pmc">
      <div class="pmc__head">
        <span class="pmc__month">{{ monthLabel() }}</span>
      </div>
      <div class="pmc__dow" aria-hidden="true">
        @for (l of dowLabels; track l) {
          <span class="pmc__dow-cell">{{ l }}</span>
        }
      </div>
      <div class="pmc__grid">
        @for (cell of cells(); track cell.ymd) {
          <span
            class="pmc__cell"
            [class.pmc__cell--out]="!cell.inMonth"
            [class.pmc__cell--session]="cell.isSession && cell.inMonth"
            [class.pmc__cell--start]="cell.isStart"
            [class.pmc__cell--end]="cell.isEnd"
            [class.pmc__cell--today]="cell.isToday"
            [attr.aria-label]="cell.ymd"
          >{{ cell.day }}</span>
        }
      </div>
      <div class="pmc__legend">
        <span class="pmc__legend-item"><span class="pmc__dot pmc__dot--start"></span>Inicio</span>
        <span class="pmc__legend-item"><span class="pmc__dot pmc__dot--session"></span>Sesión</span>
        <span class="pmc__legend-item"><span class="pmc__dot pmc__dot--end"></span>Fin</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pmc {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pmc__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
    }
    .pmc__month {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 16px;
      letter-spacing: -0.2px;
      color: var(--ink-900);
    }
    .pmc__dow {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .pmc__dow-cell {
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--ink-400);
      text-transform: uppercase;
    }
    .pmc__grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .pmc__cell {
      aspect-ratio: 1 / 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(0, 0, 0, 0.03);
      color: var(--ink-700);
    }
    .pmc__cell--out {
      color: var(--ink-300);
      background: transparent;
    }
    .pmc__cell--session {
      background: rgba(var(--kengo-primary-rgb), 0.18);
      color: var(--kengo-primary-dark);
      font-weight: 700;
    }
    .pmc__cell--today {
      outline: 1px solid rgba(var(--kengo-primary-rgb), 0.4);
      outline-offset: -1px;
    }
    .pmc__cell--start {
      background: var(--kengo-primary);
      color: white;
      box-shadow: 0 4px 10px -3px rgba(var(--kengo-primary-rgb), 0.5);
    }
    .pmc__cell--end {
      background: var(--kengo-tertiary, #efc048);
      color: var(--ink-900);
      box-shadow: 0 4px 10px -3px rgba(239, 192, 72, 0.4);
    }
    .pmc__legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: var(--ink-500);
      text-transform: uppercase;
    }
    .pmc__legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .pmc__dot {
      width: 8px;
      height: 8px;
      border-radius: 3px;
    }
    .pmc__dot--start { background: var(--kengo-primary); }
    .pmc__dot--end { background: var(--kengo-tertiary, #efc048); }
    .pmc__dot--session { background: rgba(var(--kengo-primary-rgb), 0.35); }
  `],
})
export class PlanMiniCalendarComponent {
  readonly fechaInicio = input<string | null | undefined>(null);
  readonly fechaFin = input<string | null | undefined>(null);
  readonly diasActivos = input<DiaSemana[] | null>(null);

  readonly dowLabels = DOW_LABELS;

  /** YYYY-MM-DD que ancla el mes mostrado: inicio del plan, hoy o fin. */
  private readonly anchorYmd = computed<string>(() => {
    return this.fechaInicio() || getMadridDate() || this.fechaFin() || getMadridDate();
  });

  readonly monthLabel = computed<string>(() => {
    const ymd = this.anchorYmd();
    const d = ymdToDateForDisplay(ymd);
    return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  });

  readonly cells = computed<CalCell[]>(() => {
    const anchor = this.anchorYmd();
    const today = getMadridDate();
    const start = this.fechaInicio() || null;
    const end = this.fechaFin() || null;
    const dias = new Set(this.diasActivos() ?? []);

    const a = ymdToDateForDisplay(anchor);
    const year = a.getUTCFullYear();
    const month = a.getUTCMonth();
    const firstOfMonth = new Date(Date.UTC(year, month, 1, 12));
    const lastOfMonth = new Date(Date.UTC(year, month + 1, 0, 12));
    // 0=Sun..6=Sat → 0=Mon..6=Sun
    const firstDow = (firstOfMonth.getUTCDay() + 6) % 7;
    const totalDays = lastOfMonth.getUTCDate();
    // Necesitamos múltiplos de 7. Calcular celdas previas (mes anterior)
    const prevMonthLast = new Date(Date.UTC(year, month, 0, 12));
    const prevMonthDays = prevMonthLast.getUTCDate();

    const out: CalCell[] = [];

    // Días del mes anterior (gris)
    for (let i = firstDow - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const ymd = this.formatYmd(year, month - 1, day);
      out.push(this.buildCell(ymd, day, false, start, end, dias, today));
    }

    // Días del mes actual
    for (let day = 1; day <= totalDays; day++) {
      const ymd = this.formatYmd(year, month, day);
      out.push(this.buildCell(ymd, day, true, start, end, dias, today));
    }

    // Padding del mes siguiente hasta completar 6 semanas (42 celdas) o múltiplo de 7
    const remaining = (7 - (out.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const ymd = this.formatYmd(year, month + 1, day);
      out.push(this.buildCell(ymd, day, false, start, end, dias, today));
    }

    return out;
  });

  private buildCell(
    ymd: string,
    day: number,
    inMonth: boolean,
    start: string | null,
    end: string | null,
    dias: Set<DiaSemana>,
    today: string,
  ): CalCell {
    const isStart = !!start && ymd === start;
    const isEnd = !!end && ymd === end;
    let isSession = false;
    if (inMonth && start && end && !isStart && !isEnd) {
      // Dentro del rango y día de la semana activo.
      const inRange =
        daysBetweenYMD(start, ymd) >= 0 && daysBetweenYMD(ymd, end) >= 0;
      if (inRange && dias.size > 0) {
        const dia = diaSemanaFromYMD(ymd);
        isSession = dias.has(dia);
      }
    }
    return {
      ymd,
      day,
      inMonth,
      isStart,
      isEnd,
      isSession,
      isToday: ymd === today,
    };
  }

  private formatYmd(year: number, month: number, day: number): string {
    // Normaliza meses fuera de rango (negativos o > 11) recreando un Date UTC.
    const d = new Date(Date.UTC(year, month, day, 12));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}
