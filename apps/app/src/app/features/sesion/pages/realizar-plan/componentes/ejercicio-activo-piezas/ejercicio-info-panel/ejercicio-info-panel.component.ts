import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TemporizadorComponent } from '../../temporizador/temporizador.component';
import { TimelineSesionComponent } from '../../timeline-sesion/timeline-sesion.component';
import { SafeHtmlPipe } from '../../../../../../../shared/pipes/safe-html.pipe';
import { EjercicioPlan } from '../../../../../../../../types/global';
import { fadeAnimation } from '../../../realizar-plan.animations';

@Component({
  selector: 'app-ejercicio-info-panel',
  standalone: true,
  imports: [TemporizadorComponent, TimelineSesionComponent, SafeHtmlPipe],
  animations: [fadeAnimation],
  templateUrl: './ejercicio-info-panel.component.html',
  styleUrl: './ejercicio-info-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EjercicioInfoPanelComponent {
  readonly nombre = input<string | null>(null);
  readonly serieActual = input.required<number>();
  readonly totalSeries = input.required<number>();
  readonly esTemporizador = input.required<boolean>();
  readonly duracionSeg = input.required<number>();
  readonly repeticiones = input.required<number>();
  readonly descripcion = input<string>('');
  readonly instrucciones = input<string>('');
  readonly notasFisio = input<string>('');
  readonly esDesktop = input.required<boolean>();
  readonly videoExpandido = input.required<boolean>();
  readonly videoReproduciendo = input.required<boolean>();
  readonly esUltimaSerie = input.required<boolean>();

  readonly tiempoAgotado = output<void>();
  readonly togglePanel = output<void>();
  readonly completarSerie = output<void>();
  readonly togglePlayPause = output<void>();
  readonly abrirTimeline = output<void>();
  readonly previewEjercicio = output<{ ejercicio: EjercicioPlan; index: number }>();

  readonly seriesArray = computed(() => {
    const total = this.totalSeries();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  onPlayPauseClick(event: Event): void {
    event.stopPropagation();
    this.togglePlayPause.emit();
  }
}
