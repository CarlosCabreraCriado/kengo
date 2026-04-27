import {
  Component,
  Output,
  EventEmitter,
  inject,
  computed,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { RegistroSesionService } from '../../../../data-access/registro-sesion.service';
import { TemporizadorComponent } from '../../componentes/temporizador/temporizador.component';
import { TimelineSesionComponent } from '../../componentes/timeline-sesion/timeline-sesion.component';
import { SafeHtmlPipe } from '../../../../../../shared/pipes/safe-html.pipe';
import { KENGO_BREAKPOINTS } from '../../../../../../shared';
import { EjercicioPlan } from '../../../../../../../types/global';
import { fadeAnimation } from '../../realizar-plan.animations';

@Component({
  selector: 'app-ejercicio-activo',
  standalone: true,
  imports: [TemporizadorComponent, SafeHtmlPipe, TimelineSesionComponent],
  animations: [fadeAnimation],
  templateUrl: './ejercicio-activo.component.html',
  styleUrl: './ejercicio-activo.component.css',
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

  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  private registroService = inject(RegistroSesionService);
  private breakpointObserver = inject(BreakpointObserver);

  readonly esDesktop = signal(false);

  constructor() {
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.DESKTOP])
      .pipe(takeUntilDestroyed())
      .subscribe((result) => this.esDesktop.set(result.matches));
  }

  readonly ejercicio = this.registroService.ejercicioActual;
  readonly serieActual = this.registroService.serieActual;
  readonly totalSeries = this.registroService.totalSeries;
  readonly esUltimaSerie = this.registroService.esUltimaSerie;
  readonly esTemporizador = this.registroService.esTipoTemporizador;

  // Progreso de la sesión
  readonly ejercicioActualIndex = this.registroService.ejercicioActualIndex;
  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly progresoSesion = this.registroService.progresoSesion;

  // Estado del video
  readonly videoReproduciendo = signal<boolean>(true);
  readonly videoExpandido = signal<boolean>(false);
  readonly showPlayIndicator = signal<boolean>(false);

  // Control de gestos táctiles
  private touchStartY = 0;

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

  readonly instrucciones = computed(
    () => this.ejercicio()?.instruccionesPaciente || '',
  );

  readonly descripcion = computed(
    () => this.ejercicio()?.ejercicio?.descripcion || '',
  );

  readonly notasFisio = computed(
    () => this.ejercicio()?.notasFisio || '',
  );

  // Array de series para el tracker visual
  readonly seriesArray = computed(() => {
    const total = this.totalSeries();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  toggleExpandido(): void {
    this.videoExpandido.update((v) => !v);
  }

  toggleVideo(): void {
    if (!this.videoPlayer?.nativeElement) return;

    const video = this.videoPlayer.nativeElement;
    if (video.paused) {
      video.play();
      this.videoReproduciendo.set(true);
    } else {
      video.pause();
      this.videoReproduciendo.set(false);
    }

    // Mostrar indicador de play/pause brevemente
    this.showPlayIndicator.set(true);
    setTimeout(() => this.showPlayIndicator.set(false), 600);
  }

  // Scroll con rueda del ratón (desktop)
  onWheel(event: WheelEvent): void {
    // Scroll hacia arriba -> expandir video (ocultar panel)
    if (event.deltaY < -30 && !this.videoExpandido()) {
      this.videoExpandido.set(true);
    }
    // Scroll hacia abajo -> contraer video (mostrar panel)
    if (event.deltaY > 30 && this.videoExpandido()) {
      this.videoExpandido.set(false);
    }
  }

  // Gestos táctiles (móvil)
  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent): void {
    const touchEndY = event.changedTouches[0].clientY;
    const deltaY = this.touchStartY - touchEndY;

    // Swipe hacia abajo (deltaY < 0) -> expandir video (ocultar panel)
    if (deltaY < -50 && !this.videoExpandido()) {
      this.videoExpandido.set(true);
    }
    // Swipe hacia arriba (deltaY > 0) -> contraer video (mostrar panel)
    if (deltaY > 50 && this.videoExpandido()) {
      this.videoExpandido.set(false);
    }
  }

  onTiempoAgotado(): void {
    // Vibrar si está disponible
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
    // Completar serie automáticamente
    this.completarSerie.emit();
  }
}
