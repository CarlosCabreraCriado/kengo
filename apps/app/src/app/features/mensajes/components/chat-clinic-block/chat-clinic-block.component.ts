import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Ui2EmptyStateComponent } from '../../../../shared/ui-v2';

/**
 * Vista de bloqueo del detalle de mensaje cuando la conversación pertenece
 * a una clínica distinta de la activa. Ofrece un CTA para cambiar la clínica
 * activa al contexto correcto; la lógica del cambio vive en el contenedor.
 */
@Component({
  selector: 'app-chat-clinic-block',
  standalone: true,
  imports: [Ui2EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="block">
      <ui2-empty-state
        icon="apartment"
        title="Conversación de otra clínica"
        [message]="message()"
        [actionLabel]="actionLabel()"
        actionIcon="swap_horiz"
        (action)="switchClinic.emit()"
      ></ui2-empty-state>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      align-items: center;
      justify-content: center;
    }
    .block {
      width: 100%;
      max-width: 420px;
    }
  `],
})
export class ChatClinicBlockComponent {
  readonly clinicName = input<string | null>(null);
  readonly switchClinic = output<void>();

  readonly message = computed(() => {
    const name = this.clinicName();
    return name
      ? `Esta conversación pertenece a ${name}. Cambia de clínica activa para verla y responder.`
      : 'Esta conversación pertenece a otra clínica. Cambia de clínica activa para verla y responder.';
  });

  readonly actionLabel = computed(() => {
    const name = this.clinicName();
    return name ? `Cambiar a ${name}` : 'Cambiar de clínica';
  });
}
