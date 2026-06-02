import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-ejercicio-video-player',
  standalone: true,
  imports: [NgOptimizedImage],
  templateUrl: './ejercicio-video-player.component.html',
  styleUrl: './ejercicio-video-player.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EjercicioVideoPlayerComponent {
  readonly videoUrl = input<string | null>(null);
  readonly posterUrl = input<string | null>(null);
  readonly nombreEjercicio = input<string | null>(null);

  readonly playStateChange = output<boolean>();

  readonly videoReproduciendo = signal(true);
  readonly showPlayIndicator = signal(false);

  private readonly videoPlayer = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');

  @HostListener('click')
  toggle(): void {
    const video = this.videoPlayer()?.nativeElement;
    if (!video) return;

    if (video.paused) {
      video.play();
      this.videoReproduciendo.set(true);
    } else {
      video.pause();
      this.videoReproduciendo.set(false);
    }

    this.playStateChange.emit(this.videoReproduciendo());
    this.showPlayIndicator.set(true);
    setTimeout(() => this.showPlayIndicator.set(false), 600);
  }
}
