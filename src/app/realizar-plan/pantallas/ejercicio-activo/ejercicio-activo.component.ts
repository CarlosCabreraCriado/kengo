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
import { CommonModule } from '@angular/common';
import { RegistroSesionService } from '../../../services/registro-sesion.service';
import { ContadorSeriesComponent } from '../../componentes/contador-series/contador-series.component';
import { TemporizadorComponent } from '../../componentes/temporizador/temporizador.component';
import { fadeAnimation } from '../../realizar-plan.animations';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-ejercicio-activo',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    ContadorSeriesComponent,
    TemporizadorComponent,
  ],
  animations: [fadeAnimation],
  template: `
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Video con estilo de detalle-ejercicio -->
      <div
        class="video-container relative -mx-5 h-[50dvh] shrink-0 overflow-hidden transition-all duration-300"
        (click)="toggleVideo()"
      >
        @if (videoUrl()) {
          <video
            #videoPlayer
            class="h-full w-full object-cover"
            [src]="videoUrl()"
            [poster]="posterUrl() || ''"
            autoplay
            muted
            loop
            playsinline
          ></video>
        } @else if (posterUrl()) {
          <img
            [src]="posterUrl()"
            [alt]="ejercicio()?.ejercicio?.nombre_ejercicio"
            class="h-full w-full object-cover"
          />
        } @else {
          <div
            class="flex h-full w-full items-center justify-center bg-zinc-100"
          >
            <mat-icon class="material-symbols-outlined !text-8xl text-zinc-300"
              >fitness_center</mat-icon
            >
          </div>
        }

        <!-- Indicador de progreso - superior derecha -->
        <div
          class="absolute top-4 right-8 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-sm"
        >
          <span class="text-xs font-bold text-white">
            {{ ejercicioActualIndex() + 1 }}/{{ totalEjercicios() }}
          </span>
          <div class="h-1.5 w-16 overflow-hidden rounded-full bg-white/30">
            <div
              class="h-full rounded-full bg-white transition-all duration-300"
              [style.width.%]="progresoSesion()"
            ></div>
          </div>
        </div>
      </div>

      <!-- Info del ejercicio -->
      <div
        class="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-evenly gap-2 overflow-hidden px-4 py-2 text-center"
        @fade
      >
        <h2
          class="m-0 shrink-0 text-xl leading-tight font-bold text-balance text-zinc-800"
        >
          {{ ejercicio()?.ejercicio?.nombre_ejercicio }}
        </h2>

        <!-- Contador de series -->
        <app-contador-series
          class="shrink-0"
          [serie]="serieActual()"
          [total]="totalSeries()"
        />

        <!-- Objetivo -->
        <div class="flex min-h-0 flex-1 items-center justify-center">
          @if (esTemporizador()) {
            <app-temporizador
              [tiempoInicial]="duracionSeg()"
              [autoIniciar]="true"
              label="segundos"
              (tiempoAgotado)="onTiempoAgotado()"
            />
          } @else {
            <div
              class="objetivo-circulo flex flex-col items-center justify-center gap-0.5 rounded-full bg-white/60 shadow-lg backdrop-blur-sm"
            >
              <span
                class="objetivo-numero bg-gradient-to-br from-[#e75c3e] to-[#d14d31] bg-clip-text leading-none font-extrabold text-transparent"
              >
                {{ repeticiones() }}
              </span>
              <span
                class="objetivo-label font-medium tracking-wider text-zinc-500 uppercase"
              >
                repeticiones
              </span>
            </div>
          }
        </div>

        <!-- Instrucciones -->
        @if (instrucciones()) {
          <div
            class="tarjeta-kengo flex min-h-0 w-full shrink items-start gap-2 overflow-hidden rounded-xl p-2.5 text-left"
          >
            <mat-icon
              class="material-symbols-outlined shrink-0 !text-lg text-[#efc048]"
              >lightbulb</mat-icon
            >
            <p class="m-0 line-clamp-2 text-xs leading-snug text-zinc-600">
              {{ instrucciones() }}
            </p>
          </div>
        }
      </div>

      <!-- Botón completar -->
      <div class="shrink-0 px-4 pt-3 pb-4">
        <button
          mat-flat-button
          class="!h-14 !w-full !rounded-2xl !bg-gradient-to-r !from-emerald-500 !to-emerald-600 !text-base !font-bold !text-white !shadow-lg hover:!shadow-xl"
          (click)="completarSerie.emit()"
        >
          @if (esUltimaSerie()) {
            Completar ejercicio
          } @else {
            Completar serie
          }
          <mat-icon class="material-symbols-outlined ml-2">check</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* Difuminado inferior del video como en detalle-ejercicio */
    .video-container {
      mask-image: linear-gradient(to bottom, black 75%, transparent 100%);
      -webkit-mask-image: linear-gradient(
        to bottom,
        black 75%,
        transparent 100%
      );
    }

    /* Círculo de objetivo adaptable - crece con el espacio disponible */
    .objetivo-circulo {
      container-type: size;
      height: 100%;
      aspect-ratio: 1;
      min-height: 5rem;
      max-height: 12rem;
    }

    .objetivo-numero {
      font-size: clamp(1.75rem, 35cqh, 4rem);
    }

    .objetivo-label {
      font-size: clamp(0.5rem, 10cqh, 0.8rem);
    }
  `,
})
export class EjercicioActivoComponent {
  @Output() completarSerie = new EventEmitter<void>();
  @Output() pausar = new EventEmitter<void>();

  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  private registroService = inject(RegistroSesionService);

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

  readonly duracionSeg = computed(() => this.ejercicio()?.duracion_seg || 30);

  readonly repeticiones = computed(() => this.ejercicio()?.repeticiones || 12);

  readonly instrucciones = computed(
    () => this.ejercicio()?.instrucciones_paciente || '',
  );

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
