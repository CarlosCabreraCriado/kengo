import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import {
  EstadisticasPaciente,
  RangoFiltro,
} from '../../../../data-access/paciente-detail.types';
import { getDolorColor } from '../../../../utils/format-helpers';
import {
  Ui2CardComponent,
  Ui2DatepickerComponent,
  Ui2EmptyStateComponent,
  Ui2IconBadgeComponent,
  Ui2KpiCardComponent,
  Ui2PillComponent,
  Ui2SegmentedComponent,
  Ui2SegmentedOption,
  Ui2SpinnerComponent,
} from '../../../../../../shared/ui-v2';

const RANGO_OPTIONS: Ui2SegmentedOption[] = [
  { id: '15', label: '15d' },
  { id: '30', label: '30d' },
  { id: '60', label: '60d' },
  { id: '90', label: '90d' },
  { id: 'todo', label: 'Todo' },
  { id: 'custom', label: 'Rango' },
];

@Component({
  selector: 'app-paciente-estadisticas',
  standalone: true,
  imports: [
    DecimalPipe,
    Ui2CardComponent,
    Ui2DatepickerComponent,
    Ui2EmptyStateComponent,
    Ui2IconBadgeComponent,
    Ui2KpiCardComponent,
    Ui2PillComponent,
    Ui2SegmentedComponent,
    Ui2SpinnerComponent,
  ],
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
  protected readonly rangoOptions = RANGO_OPTIONS;

  protected readonly canApplyCustom = computed(() => {
    const desde = this.filtroDesde();
    const hasta = this.filtroHasta();
    return !!(desde && hasta && desde <= hasta);
  });

  protected readonly dolorPromedio = computed(() => {
    const v = this.estadisticas()?.promedioDolorGeneral;
    return v === null || v === undefined ? null : v;
  });

  constructor() {
    queueMicrotask(() => this.expanded.set(this.defaultExpanded()));
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  protected onRangoSelect(id: string): void {
    this.aplicarFiltroRango.emit(id as RangoFiltro);
  }

  protected getDolorColor = getDolorColor;
}
