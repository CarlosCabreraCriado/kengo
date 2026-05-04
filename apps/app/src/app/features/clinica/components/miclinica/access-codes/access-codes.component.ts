import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2IconBadgeComponent,
  Ui2PillComponent,
  Ui2SpinnerComponent,
} from '../../../../../shared/ui-v2';
import { CodigoAcceso } from '../../../../../../types/global';

@Component({
  selector: 'app-mc-access-codes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    Ui2CardComponent,
    Ui2IconBadgeComponent,
    Ui2ButtonComponent,
    Ui2PillComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './access-codes.component.html',
  styleUrl: './access-codes.component.css',
})
export class MiClinicaAccessCodesComponent {
  readonly codigos = input.required<CodigoAcceso[]>();
  readonly loading = input<boolean>(false);
  readonly puedeGenerar = input<boolean>(false);
  readonly expandable = input<boolean>(false);
  readonly expanded = input<boolean>(true);

  readonly generarCodigo = output<void>();
  readonly copiarCodigo = output<string>();
  readonly desactivar = output<string>();
  readonly reactivar = output<string>();
  readonly toggleExpand = output<void>();
}
