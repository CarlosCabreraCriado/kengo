import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  input,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { buildAssetUrl, parseAssetUrl } from '../../../core/utils/asset-url';

/** Tamaño del póster: el contenedor es 16:9 a ancho completo. */
const POSTER_WIDTH = 1280;
const POSTER_HEIGHT = 720;

@Component({
  selector: 'app-video-ejercicio',
  standalone: true,
  imports: [],
  template: `
    <div
      class="video-container relative aspect-video w-full cursor-pointer overflow-hidden rounded-3xl bg-zinc-800 shadow-xl transition-all duration-300"
      [class.expanded]="expandido()"
      (click)="togglePausa()"
    >
      @if (videoUrl) {
        <video
          #videoElement
          class="h-full w-full"
          [class.object-cover]="fit() === 'cover'"
          [class.object-contain]="fit() === 'contain'"
          [src]="videoUrl"
          [poster]="posterSrc"
          loop
          muted
          playsinline
          (loadeddata)="onVideoLoaded()"
        ></video>
      } @else if (posterUrl) {
        <img
          class="h-full w-full"
          [class.object-cover]="fit() === 'cover'"
          [class.object-contain]="fit() === 'contain'"
          [src]="posterSrc"
          alt="Imagen del ejercicio"
        />
      } @else {
        <div class="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-kengo-primary to-kengo-tertiary">
          <span class="material-symbols-outlined text-6xl text-white/90">videocam</span>
          <span class="text-sm font-medium text-white/90">Sin video disponible</span>
        </div>
      }

      <!-- Overlay de pausa -->
      @if (pausado()) {
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
          <div class="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-kengo-primary to-kengo-primary-dark pl-1 shadow-xl transition-transform hover:scale-110">
            <span class="material-symbols-outlined text-4xl text-white">play_arrow</span>
          </div>
          <span class="text-sm font-medium text-white drop-shadow-md">Toca para reproducir</span>
        </div>
      }

      <!-- Indicador de carga -->
      @if (cargando()) {
        <div class="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div class="loading-spinner h-14 w-14 animate-spin rounded-full border-4 border-white/20"></div>
        </div>
      }

      <!-- Botón expandir -->
      <button
        type="button"
        class="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-md transition-colors hover:bg-white/25"
        (click)="toggleExpandir($event)"
      >
        <span class="material-symbols-outlined text-white">
          {{ expandido() ? 'close_fullscreen' : 'open_in_full' }}
        </span>
      </button>
    </div>
  `,
  styles: `
    .video-container.expanded {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: var(--z-modal);
      border-radius: 0;
      aspect-ratio: auto;
    }

    .video-container.expanded video,
    .video-container.expanded img {
      object-fit: contain;
      background: #000;
    }

    .loading-spinner {
      border-top-color: var(--kengo-primary);
    }
  `,
})
export class VideoEjercicioComponent implements AfterViewInit {
  @Input() videoUrl: string | null = null;
  @Input() posterUrl: string | null = null;

  /**
   * `<video poster>` no admite `ngSrc`, así que la transformación de
   * Cloudflare (`/cdn-cgi/image/...`) se aplica aquí de forma explícita.
   * Las URLs que no son de assets (blobs, locales) se devuelven tal cual.
   */
  get posterSrc(): string | null {
    if (!this.posterUrl) return null;
    const parsed = parseAssetUrl(this.posterUrl);
    if (!parsed) return this.posterUrl;
    return buildAssetUrl(parsed.base, parsed.key, {
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      fit: 'cover',
      format: 'webp',
      quality: 80,
    });
  }
  @Input() autoplay = true;
  readonly fit = input<'cover' | 'contain'>('cover');

  @Output() expandirChange = new EventEmitter<boolean>();

  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;

  readonly pausado = signal(false);
  readonly expandido = signal(false);
  readonly cargando = signal(true);

  ngAfterViewInit(): void {
    if (this.autoplay && this.videoRef?.nativeElement) {
      this.reproducir();
    }
  }

  onVideoLoaded(): void {
    this.cargando.set(false);
    if (this.autoplay) {
      this.reproducir();
    }
  }

  reproducir(): void {
    const video = this.videoRef?.nativeElement;
    if (video) {
      video.play().catch(() => {
        // El autoplay puede fallar si el usuario no ha interactuado
        this.pausado.set(true);
      });
      this.pausado.set(false);
    }
  }

  pausar(): void {
    const video = this.videoRef?.nativeElement;
    if (video) {
      video.pause();
      this.pausado.set(true);
    }
  }

  togglePausa(): void {
    if (this.pausado()) {
      this.reproducir();
    } else {
      this.pausar();
    }
  }

  toggleExpandir(event: Event): void {
    event.stopPropagation();
    const nuevoEstado = !this.expandido();
    this.expandido.set(nuevoEstado);
    this.expandirChange.emit(nuevoEstado);
  }
}
