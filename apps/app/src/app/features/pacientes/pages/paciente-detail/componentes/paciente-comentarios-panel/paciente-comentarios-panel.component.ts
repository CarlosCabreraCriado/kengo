import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NotificacionFisio } from '../../../../../../../types/global';
import {
  formatearFechaComentario,
  getDolorColor,
} from '../../../../utils/format-helpers';
import {
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2IconBadgeComponent,
  Ui2PillComponent,
  Ui2SpinnerComponent,
} from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-paciente-comentarios-panel',
  standalone: true,
  imports: [
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2IconBadgeComponent,
    Ui2PillComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './paciente-comentarios-panel.component.html',
  styleUrl: './paciente-comentarios-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacienteComentariosPanelComponent {
  readonly comentarios = input<NotificacionFisio[]>([]);
  readonly comentariosPendientes = input<number>(0);
  readonly isLoading = input<boolean>(true);
  readonly defaultExpanded = input<boolean>(true);

  readonly irASesionComentario = output<NotificacionFisio>();
  readonly marcarRevisado = output<NotificacionFisio>();
  readonly marcarTodosRevisados = output<void>();

  protected readonly expanded = signal(true);
  protected readonly subtitle = computed(() => {
    const pendientes = this.comentariosPendientes();
    if (pendientes > 0) {
      return `${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`;
    }
    const total = this.comentarios().length;
    return `${total} comentario${total !== 1 ? 's' : ''}`;
  });

  constructor() {
    queueMicrotask(() => this.expanded.set(this.defaultExpanded()));
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  protected formatearFechaComentario = formatearFechaComentario;
  protected getDolorColor = getDolorColor;
}
