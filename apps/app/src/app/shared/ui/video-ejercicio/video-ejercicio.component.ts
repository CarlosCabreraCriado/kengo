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
  DestroyRef,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { buildAssetUrl, parseAssetUrl } from '../../../core/utils/asset-url';
import { BackButtonService, BackHandler } from '../../../core/services/back-button.service';

/** APIs de fullscreen con prefijo WebKit (iOS/Safari), ausentes del lib.dom. */
interface WebkitVideoElement extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

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
      role="button"
      tabindex="0"
      [attr.aria-label]="pausado() ? 'Reproducir vídeo' : 'Pausar vídeo'"
      (click)="togglePausa()"
      (keydown.enter)="togglePausa()"
      (keydown.space)="$event.preventDefault(); togglePausa()"
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
          (webkitendfullscreen)="onSalirPantallaCompleta()"
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

      <!-- Botón pantalla completa: delega en el reproductor nativo -->
      @if (videoUrl) {
        <button
          type="button"
          class="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-md transition-colors hover:bg-white/25"
          aria-label="Ver a pantalla completa"
          (click)="abrirPantallaCompleta($event)"
        >
          <span class="material-symbols-outlined text-white" aria-hidden="true">open_in_full</span>
        </button>
      }
    </div>
  `,
  styles: `
    .loading-spinner {
      border-top-color: var(--kengo-primary);
    }
  `,
})
export class VideoEjercicioComponent implements AfterViewInit, BackHandler {
  private readonly document = inject(DOCUMENT);
  private readonly backButton = inject(BackButtonService);

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

  /** Si el vídeo se estaba reproduciendo al entrar en pantalla completa. */
  private reproduciendoAlEntrar = false;

  constructor() {
    // Salida del fullscreen estándar (web, Android): Esc, gesto atrás o
    // control nativo. iOS usa `webkitendfullscreen` en el propio <video>.
    const onFullscreenChange = () => {
      if (this.expandido() && !this.document.fullscreenElement) {
        this.onSalirPantallaCompleta();
      }
    };
    this.document.addEventListener('fullscreenchange', onFullscreenChange);
    this.document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('fullscreenchange', onFullscreenChange);
      this.document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      this.backButton.unregister(this);
    });
  }

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

  /**
   * Abre el reproductor nativo en vez de un overlay propio: un `fixed` dentro
   * de un ancestro con containment (p. ej. `container-type`) o transform no
   * cubre el viewport y el botón de cerrar podía quedar fuera de pantalla.
   */
  abrirPantallaCompleta(event: Event): void {
    event.stopPropagation();
    const video = this.videoRef?.nativeElement as WebkitVideoElement | undefined;
    if (!video) return;

    this.reproduciendoAlEntrar = !video.paused;
    video.controls = true;
    this.expandido.set(true);
    this.expandirChange.emit(true);
    this.backButton.register(this);

    // Web y Android: Fullscreen API estándar. iOS (iPhone) no la expone en
    // elementos, pero sí `webkitEnterFullscreen`, que abre AVPlayer nativo.
    const request = video.requestFullscreen?.bind(video) ?? video.webkitRequestFullscreen?.bind(video);
    if (request) {
      Promise.resolve(request()).catch(() => this.onSalirPantallaCompleta());
    } else if (typeof video.webkitEnterFullscreen === 'function') {
      video.webkitEnterFullscreen();
    } else {
      this.onSalirPantallaCompleta();
    }
  }

  onSalirPantallaCompleta(): void {
    if (!this.expandido()) return;
    this.expandido.set(false);
    this.expandirChange.emit(false);
    this.backButton.unregister(this);

    const video = this.videoRef?.nativeElement;
    if (!video) return;
    video.controls = false;
    // iOS pausa al cerrar AVPlayer; reanudamos si iba reproduciéndose.
    if (this.reproduciendoAlEntrar && video.paused) {
      this.reproducir();
    } else {
      this.pausado.set(video.paused);
    }
  }

  /** Botón atrás de Android con el vídeo a pantalla completa. */
  handleBack(): boolean {
    if (!this.expandido()) return false;
    if (this.document.fullscreenElement) {
      void this.document.exitFullscreen().catch(() => undefined);
    } else {
      this.onSalirPantallaCompleta();
    }
    return true;
  }
}
