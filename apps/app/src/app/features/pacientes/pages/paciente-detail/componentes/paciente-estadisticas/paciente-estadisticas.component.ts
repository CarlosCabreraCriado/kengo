import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import {
  EstadisticasPaciente,
  RangoFiltro,
} from '../../../../data-access/paciente-detail.types';
import { getDolorColor } from '../../../../utils/format-helpers';

@Component({
  selector: 'app-paciente-estadisticas',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './paciente-estadisticas.component.html',
  styleUrl: './paciente-estadisticas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacienteEstadisticasComponent {
  readonly estadisticas = input<EstadisticasPaciente | null>(null);
  readonly isLoading = input<boolean>(true);
  readonly filtroRango = input<RangoFiltro>('15');
  readonly filtroDesde = input<string | null>(null);
  readonly filtroHasta = input<string | null>(null);
  readonly isCustomRange = input<boolean>(false);
  readonly rangoLabel = input<string>('');
  readonly filterPanelOpen = input<boolean>(false);
  readonly hoy = input<string>('');
  readonly defaultExpanded = input<boolean>(true);

  readonly aplicarFiltroRango = output<RangoFiltro>();
  readonly aplicarRangoPersonalizado = output<void>();
  readonly desdeChange = output<string | null>();
  readonly hastaChange = output<string | null>();
  readonly resetearFiltro = output<void>();

  protected readonly expanded = signal(true);

  constructor() {
    queueMicrotask(() => this.expanded.set(this.defaultExpanded()));
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  protected onDesde(event: Event): void {
    const value = (event.target as HTMLInputElement).value || null;
    this.desdeChange.emit(value);
  }

  protected onHasta(event: Event): void {
    const value = (event.target as HTMLInputElement).value || null;
    this.hastaChange.emit(value);
  }

  protected getDolorColor = getDolorColor;
}
