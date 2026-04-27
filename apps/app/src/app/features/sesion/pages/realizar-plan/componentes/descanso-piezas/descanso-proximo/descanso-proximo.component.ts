import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EjercicioPlan } from '../../../../../../../../types/global';
import { fadeAnimation } from '../../../realizar-plan.animations';

@Component({
  selector: 'app-descanso-proximo',
  standalone: true,
  animations: [fadeAnimation],
  templateUrl: './descanso-proximo.component.html',
  styleUrl: './descanso-proximo.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DescansoProximoComponent {
  readonly esEntreEjercicios = input.required<boolean>();
  readonly proximoEjercicio = input<EjercicioPlan | null>(null);
  readonly proximoPortadaUrl = input<string | null>(null);
  readonly serieActual = input.required<number>();
  readonly totalSeries = input.required<number>();

  readonly previewClick = output<void>();
}
