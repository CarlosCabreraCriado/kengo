import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { Ui2ButtonComponent, Ui2CardComponent } from '../../../../../shared/ui-v2';

@Component({
  selector: 'app-mc-role-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UpperCasePipe, Ui2CardComponent, Ui2ButtonComponent],
  templateUrl: './role-card.component.html',
  styleUrl: './role-card.component.css',
})
export class MiClinicaRoleCardComponent {
  readonly rolNombre = input.required<string>();
  readonly rolIcono = input<string>('admin_panel_settings');
  readonly puedeEditar = input<boolean>(false);

  readonly editarClinica = output<void>();
}
