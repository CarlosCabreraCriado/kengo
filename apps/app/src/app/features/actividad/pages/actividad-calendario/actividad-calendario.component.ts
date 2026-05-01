import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PatientCalendarComponent } from '../../ui/patient-calendar/patient-calendar.component';

@Component({
  selector: 'app-actividad-calendario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PatientCalendarComponent],
  templateUrl: './actividad-calendario.component.html',
  styleUrl: './actividad-calendario.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full',
  },
})
export class ActividadCalendarioComponent {}
