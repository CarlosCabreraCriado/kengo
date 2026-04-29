import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { EstadoPlan, Plan } from '../../../../../../../types/global';
import { formatearFecha } from '../../../../utils/format-helpers';
import {
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2IconBadgeComponent,
  Ui2PillComponent,
  Ui2PillVariant,
  Ui2SpinnerComponent,
} from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-paciente-planes-list',
  standalone: true,
  imports: [
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2IconBadgeComponent,
    Ui2PillComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './paciente-planes-list.component.html',
  styleUrl: './paciente-planes-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacientePlanesListComponent {
  readonly planes = input<Plan[]>([]);
  readonly isLoading = input<boolean>(true);
  readonly defaultExpanded = input<boolean>(true);

  readonly verPlan = output<Plan>();
  readonly crearPlan = output<void>();

  protected readonly expanded = signal(true);
  protected readonly subtitle = computed(() => {
    const n = this.planes().length;
    return `${n} plan${n !== 1 ? 'es' : ''} asignado${n !== 1 ? 's' : ''}`;
  });

  constructor() {
    queueMicrotask(() => this.expanded.set(this.defaultExpanded()));
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  protected formatearFecha = formatearFecha;

  protected getEstadoLabel(estado: EstadoPlan): string {
    const labels: Record<EstadoPlan, string> = {
      borrador: 'Borrador',
      activo: 'Activo',
      completado: 'Completado',
      cancelado: 'Cancelado',
    };
    return labels[estado] || estado;
  }

  protected getEstadoVariant(estado: EstadoPlan): Ui2PillVariant {
    const map: Record<EstadoPlan, Ui2PillVariant> = {
      borrador: 'neutral',
      activo: 'success',
      completado: 'soft',
      cancelado: 'danger',
    };
    return map[estado] ?? 'neutral';
  }
}
