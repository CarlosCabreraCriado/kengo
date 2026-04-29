import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Ui2CardComponent } from '../card/card.component';
import { Ui2DateTileComponent } from '../date-tile/date-tile.component';
import { Ui2PillComponent } from '../pill/pill.component';

export interface Ui2AppointmentVm {
  weekday: string;
  day: string | number;
  month: string;
  titulo: string;
  meta: string;
  ubicacion: string | null;
}

/**
 * Next appointment V2 — card con eyebrow + DateTile + datos cita + pills "Reagendar" / "Añadir al calendario".
 * Usado solo en vista desktop de `/inicio/paciente`.
 */
@Component({
  selector: 'ui2-next-appointment',
  standalone: true,
  imports: [Ui2CardComponent, Ui2DateTileComponent, Ui2PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui2-card [padding]="18">
      <span class="ui2-na__eyebrow">Próxima cita</span>
      <div class="ui2-na__body">
        <ui2-date-tile
          [weekday]="data().weekday"
          [day]="data().day"
          [month]="data().month"
        ></ui2-date-tile>
        <div class="ui2-na__text">
          <span class="ui2-na__title">{{ data().titulo }}</span>
          <span class="ui2-na__meta">{{ data().meta }}</span>
          @if (data().ubicacion) {
            <span class="ui2-na__location">
              <span class="material-symbols-outlined" aria-hidden="true">location_on</span>
              {{ data().ubicacion }}
            </span>
          }
        </div>
      </div>
      <div class="ui2-na__actions">
        <ui2-pill
          variant="soft"
          size="md"
          [clickable]="true"
          (pillClick)="rescheduleClick.emit()"
        >Reagendar</ui2-pill>
        <ui2-pill
          variant="neutral"
          size="md"
          [clickable]="true"
          (pillClick)="calendarClick.emit()"
        >Añadir al calendario</ui2-pill>
      </div>
    </ui2-card>
  `,
  styles: [`
    :host { display: block; }
    .ui2-na__eyebrow {
      display: block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--ink-500);
      margin-bottom: 12px;
      line-height: 1;
    }
    .ui2-na__body {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    .ui2-na__text {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    .ui2-na__title {
      font-size: 14px;
      font-weight: 700;
      color: var(--ink-900);
      line-height: 1.2;
    }
    .ui2-na__meta {
      font-size: 12px;
      color: var(--ink-500);
      margin-top: 4px;
      line-height: 1.2;
    }
    .ui2-na__location {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--ink-500);
      margin-top: 6px;
      line-height: 1;
    }
    .ui2-na__location .material-symbols-outlined {
      font-size: 13px;
      color: var(--ink-400);
    }
    .ui2-na__actions {
      display: flex;
      gap: 8px;
      margin-top: 14px;
      flex-wrap: wrap;
    }
  `],
})
export class Ui2NextAppointmentComponent {
  readonly data = input.required<Ui2AppointmentVm>();
  readonly rescheduleClick = output<void>();
  readonly calendarClick = output<void>();
}
