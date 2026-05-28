import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  Ui2AvatarComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2IconBadgeComponent,
} from '../../../../../shared/ui-v2';
import { Clinica } from '../../../../../../types/global';

@Component({
  selector: 'app-mc-clinicas-accordion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2CardComponent,
    Ui2IconBadgeComponent,
    Ui2AvatarComponent,
    Ui2ButtonComponent,
  ],
  templateUrl: './clinicas-accordion.component.html',
  styleUrl: './clinicas-accordion.component.css',
})
export class MiClinicaClinicasAccordionComponent {
  readonly clinicas = input.required<Clinica[]>();
  readonly activeClinicId = input<string | null>(null);
  readonly puestoFn = input<(clinicId: string) => string | null>(() => null);
  readonly logoUrlFn = input<
    (logoId: string | null | undefined) => string | null
  >(() => null);
  readonly expanded = input<boolean>(false);

  readonly toggleExpand = output<void>();
  readonly clinicaSeleccionada = output<string>();
  readonly abrirVincularOCrear = output<void>();

  onSelect(clinicId: string): void {
    if (clinicId === this.activeClinicId()) return;
    this.clinicaSeleccionada.emit(clinicId);
  }

  resolveLogo(logoId: string | null | undefined): string | null {
    return this.logoUrlFn()(logoId);
  }

  puestoLabel(p: string | null): string {
    if (p === 'admin') return 'Administrador';
    if (p === 'fisio') return 'Fisioterapeuta';
    if (p === 'paciente') return 'Paciente';
    return '';
  }
}
