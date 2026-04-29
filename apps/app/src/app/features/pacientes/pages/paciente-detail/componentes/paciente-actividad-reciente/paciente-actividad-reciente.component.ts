import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { NotificacionFisio } from '../../../../../../../types/global';
import {
  RangoFiltro,
  SesionAgrupada,
} from '../../../../data-access/paciente-detail.types';
import {
  getDolorColor,
  getPlanStatusClass,
  getTipoColor,
  getTipoIcon,
} from '../../../../utils/format-helpers';
import {
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2IconBadgeComponent,
  Ui2SpinnerComponent,
} from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-paciente-actividad-reciente',
  standalone: true,
  imports: [
    DecimalPipe,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2IconBadgeComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './paciente-actividad-reciente.component.html',
  styleUrl: './paciente-actividad-reciente.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacienteActividadRecienteComponent {
  readonly sesionesVisibles = input<SesionAgrupada[]>([]);
  readonly totalSesiones = input<number>(0);
  readonly isLoading = input<boolean>(true);
  readonly rangoLabel = input<string>('');
  readonly diasProgramados = input<number>(0);
  readonly diasSinActividad = input<number>(0);
  readonly filtroRango = input<RangoFiltro>('15');
  readonly fechaExpandida = input<string | null>(null);
  readonly notificacionesPorRegistro = input<
    Record<string, NotificacionFisio>
  >({});
  readonly defaultExpanded = input<boolean>(true);

  readonly verSesion = output<SesionAgrupada>();
  readonly toggleComentarios = output<string>();
  readonly marcarComentarioRevisado = output<NotificacionFisio>();

  protected readonly expanded = signal(true);

  constructor() {
    queueMicrotask(() => this.expanded.set(this.defaultExpanded()));
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  protected getDolorColor = getDolorColor;
  protected getTipoIcon = getTipoIcon;
  protected getTipoColor = getTipoColor;
  protected getPlanStatusClass = getPlanStatusClass;

  protected notifPara(idRegistro: string): NotificacionFisio | undefined {
    return this.notificacionesPorRegistro()[idRegistro];
  }
}
