import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-ejercicio',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="video-container"
      [class.expanded]="expandido()"
      (click)="togglePausa()"
    >
      @if (videoUrl) {
        <video
          #videoElement
          class="video-player"
          [src]="videoUrl"
          [poster]="posterUrl"
          loop
          muted
          playsinline
          (loadeddata)="onVideoLoaded()"
        ></video>
      } @else if (posterUrl) {
        <img
          class="video-poster"
          [src]="posterUrl"
          alt="Imagen del ejercicio"
        />
      } @else {
        <div class="video-placeholder">
          <span class="placeholder-icon">🎬</span>
          <span class="placeholder-text">Sin video disponible</span>
        </div>
      }

      <!-- Overlay de pausa -->
      @if (pausado()) {
        <div class="pause-overlay">
          <div class="pause-icon">▶</div>
          <span class="pause-text">Toca para reproducir</span>
        </div>
      }

      <!-- Indicador de carga -->
      @if (cargando()) {
        <div class="loading-overlay">
          <div class="loading-spinner"></div>
        </div>
      }

      <!-- Botón expandir -->
      <button
        type="button"
        class="expand-btn"
        (click)="toggleExpandir($event)"
      >
        @if (expandido()) {
          <span>↙</span>
        } @else {
          <span>↗</span>
        }
      </button>
    </div>
  `,
  styles: `
    .video-container {
      position: relative;
      width: 100%;
      aspect-ratio: 16/9;
      background: #000;
      border-radius: 16px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .video-container.expanded {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 100;
      border-radius: 0;
      aspect-ratio: auto;
    }

    .video-player,
    .video-poster {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .video-container.expanded .video-player,
    .video-container.expanded .video-poster {
      object-fit: contain;
    }

    .video-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
    }

    .placeholder-icon {
      font-size: 3rem;
    }

    .placeholder-text {
      color: #9ca3af;
      font-size: 0.875rem;
    }

    .pause-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    }

    .pause-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      color: #1f2937;
      padding-left: 4px;
    }

    .pause-text {
      color: white;
      font-size: 0.875rem;
    }

    .loading-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.3);
    }

    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: #e75c3e;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .expand-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.5);
      border: none;
      color: white;
      font-size: 1.25rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .expand-btn:hover {
      background: rgba(0, 0, 0, 0.7);
      transform: scale(1.1);
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class VideoEjercicioComponent implements AfterViewInit {
  @Input() videoUrl: string | null = null;
  @Input() posterUrl: string | null = null;
  @Input() autoplay = true;

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
