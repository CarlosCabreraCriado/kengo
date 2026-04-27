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

@Component({
  selector: 'app-paciente-planes-list',
  standalone: true,
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
  readonly verTodosPlanes = output<void>();

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

  protected getEstadoClass(estado: EstadoPlan): string {
    const classes: Record<EstadoPlan, string> = {
      borrador: 'bg-zinc-100 text-zinc-600',
      activo: 'bg-green-100 text-green-700',
      completado: 'bg-blue-100 text-blue-700',
      cancelado: 'bg-red-100 text-red-600',
    };
    return classes[estado] || 'bg-zinc-100 text-zinc-600';
  }
}
