import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2PillComponent,
  Ui2PillVariant,
} from '../../../../../shared/ui-v2';

@Component({
  selector: 'app-mc-subscription-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Ui2CardComponent, Ui2PillComponent, Ui2ButtonComponent],
  templateUrl: './subscription-card.component.html',
  styleUrl: './subscription-card.component.css',
})
export class MiClinicaSubscriptionCardComponent {
  readonly plan = input<string>('FREE');
  readonly planLimite = input<string>('hasta 3 fisios');
  readonly pillVariant = input<Ui2PillVariant>('neutral');
  readonly pillTexto = input<string>('Inactiva');
  readonly mostrarWarning = input<boolean>(false);
  readonly warningMensaje = input<string>('Tu equipo supera el plan free.');
  readonly ctaLabel = input<string>('Activar suscripción');
  readonly renovacion = input<string>('—');

  readonly irASuscripcion = output<void>();
}
