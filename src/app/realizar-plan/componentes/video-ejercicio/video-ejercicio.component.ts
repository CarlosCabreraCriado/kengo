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
      background: #1f2937;
      border-radius: 24px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.15),
        inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    .video-container:hover {
      box-shadow:
        0 12px 40px rgba(0, 0, 0, 0.2),
        inset 0 0 0 1px rgba(255, 255, 255, 0.15);
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
      box-shadow: none;
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
      background: #000;
    }

    .video-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: linear-gradient(135deg, #e75c3e 0%, #efc048 100%);
    }

    .placeholder-icon {
      font-size: 4rem;
      opacity: 0.9;
    }

    .placeholder-text {
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.875rem;
      font-weight: 500;
    }

    .pause-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .pause-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d31 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      color: white;
      padding-left: 6px;
      box-shadow: 0 8px 24px rgba(231, 92, 62, 0.4);
      transition: all 0.3s ease;
    }

    .pause-overlay:hover .pause-icon {
      transform: scale(1.1);
      box-shadow: 0 12px 32px rgba(231, 92, 62, 0.5);
    }

    .pause-text {
      color: white;
      font-size: 0.875rem;
      font-weight: 500;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .loading-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
    }

    .loading-spinner {
      width: 56px;
      height: 56px;
      border: 4px solid rgba(255, 255, 255, 0.2);
      border-top-color: #e75c3e;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .expand-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      font-size: 1.25rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    .expand-btn:hover {
      background: rgba(255, 255, 255, 0.25);
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
