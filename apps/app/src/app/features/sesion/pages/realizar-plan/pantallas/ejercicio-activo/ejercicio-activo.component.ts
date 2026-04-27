import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { SesionStateService } from '../../../../data-access/sesion-state.service';
import { SesionProgressHeaderComponent } from '../../componentes/sesion-progress-header/sesion-progress-header.component';
import { EjercicioVideoPlayerComponent } from '../../componentes/ejercicio-activo-piezas/ejercicio-video-player/ejercicio-video-player.component';
import { EjercicioInfoPanelComponent } from '../../componentes/ejercicio-activo-piezas/ejercicio-info-panel/ejercicio-info-panel.component';
import { useResponsive } from '../../../../../../shared/composables/use-responsive';
import {
  SwipeDirection,
  SwipeGesturesDirective,
} from '../../../../../../shared/directives/swipe-gestures.directive';
import { EjercicioPlan } from '../../../../../../../types/global';

@Component({
  selector: 'app-ejercicio-activo',
  standalone: true,
  imports: [
    SesionProgressHeaderComponent,
    EjercicioVideoPlayerComponent,
    EjercicioInfoPanelComponent,
    SwipeGesturesDirective,
  ],
  templateUrl: './ejercicio-activo.component.html',
  styleUrl: './ejercicio-activo.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EjercicioActivoComponent {
  @Output() completarSerie = new EventEmitter<void>();
  @Output() pausar = new EventEmitter<void>();
  @Output() salir = new EventEmitter<void>();
  @Output() abrirTimeline = new EventEmitter<void>();
  @Output() previewEjercicio = new EventEmitter<{
    ejercicio: EjercicioPlan;
    index: number;
  }>();

  private readonly registroService = inject(SesionStateService);
  private readonly videoPlayer = viewChild(EjercicioVideoPlayerComponent);

  readonly esDesktop = useResponsive().esDesktop;

  readonly ejercicio = this.registroService.ejercicioActual;
  readonly serieActual = this.registroService.serieActual;
  readonly totalSeries = this.registroService.totalSeries;
  readonly esUltimaSerie = this.registroService.esUltimaSerie;
  readonly esTemporizador = this.registroService.esTipoTemporizador;
  readonly ejercicioActualIndex = this.registroService.ejercicioActualIndex;
  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly progresoSesion = this.registroService.progresoSesion;

  readonly videoReproduciendo = signal<boolean>(true);
  readonly videoExpandido = signal<boolean>(false);

  readonly videoUrl = computed(() => {
    const videoId = this.ejercicio()?.ejercicio?.video;
    return videoId ? this.registroService.getVideoUrl(videoId) : null;
  });

  readonly posterUrl = computed(() => {
    const portadaId = this.ejercicio()?.ejercicio?.portada;
    return portadaId
      ? this.registroService.getAssetUrl(portadaId, 800, 450)
      : null;
  });

  readonly duracionSeg = computed(() => this.ejercicio()?.duracionSeg || 30);
  readonly repeticiones = computed(() => this.ejercicio()?.repeticiones || 12);
  readonly instrucciones = computed(() => this.ejercicio()?.instruccionesPaciente || '');
  readonly descripcion = computed(() => this.ejercicio()?.ejercicio?.descripcion || '');
  readonly notasFisio = computed(() => this.ejercicio()?.notasFisio || '');
  readonly nombreEjercicio = computed(() => this.ejercicio()?.ejercicio?.nombre ?? null);

  togglePanel(): void {
    this.videoExpandido.update((v) => !v);
  }

  togglePlayPause(): void {
    this.videoPlayer()?.toggle();
  }

  onPlayStateChange(reproduciendo: boolean): void {
    this.videoReproduciendo.set(reproduciendo);
  }

  onSwipe(direction: SwipeDirection): void {
    if (direction === 'up' && !this.videoExpandido()) {
      this.videoExpandido.set(true);
    } else if (direction === 'down' && this.videoExpandido()) {
      this.videoExpandido.set(false);
    }
  }

  onTiempoAgotado(): void {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
    this.completarSerie.emit();
  }
}
