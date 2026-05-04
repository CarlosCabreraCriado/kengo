import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  Ui2CardComponent,
  Ui2IconBadgeComponent,
} from '../../../../../../../shared/ui-v2';
import { EjercicioPlan } from '../../../../../../../../types/global';
import { fadeAnimation } from '../../../realizar-plan.animations';

@Component({
  selector: 'app-descanso-proximo',
  standalone: true,
  imports: [Ui2CardComponent, Ui2IconBadgeComponent],
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
