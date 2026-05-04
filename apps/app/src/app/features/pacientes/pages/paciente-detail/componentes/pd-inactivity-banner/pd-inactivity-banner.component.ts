import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { Ui2InactivityBannerComponent } from '../../../../../../shared/ui-v2';

/**
 * Wrapper feature: muestra el banner de inactividad solo si el paciente
 * lleva `dias` o más sin actividad. La CTA dispara el flujo de chat
 * (gestionado por el contenedor padre).
 */
@Component({
  selector: 'app-pd-inactivity-banner',
  standalone: true,
  imports: [Ui2InactivityBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mostrar()) {
      <ui2-inactivity-banner
        [title]="title()"
        [body]="body()"
        icon="notifications_active"
        [actionLabel]="actionLabel()"
        variant="warn"
        (actionClick)="recordar.emit()"
      />
    }
  `,
})
export class PdInactivityBannerComponent {
  readonly dias = input<number | null>(null);
  readonly umbral = input<number>(7);
  readonly actionLabel = input<string>('Enviar recordatorio');
  readonly recordar = output<void>();

  readonly mostrar = computed(() => {
    const d = this.dias();
    return d != null && d >= this.umbral();
  });

  readonly title = computed(() => {
    const d = this.dias();
    if (d == null) return 'Sin actividad reciente';
    return `Sin actividad hace ${d} día${d === 1 ? '' : 's'}`;
  });

  readonly body = computed(() =>
    'El paciente no ha completado ejercicios en este período. Considera enviarle un recordatorio.',
  );
}
