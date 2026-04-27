import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-feedback-celebracion',
  standalone: true,
  templateUrl: './feedback-celebracion.component.html',
  styleUrl: './feedback-celebracion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackCelebracionComponent {
  readonly totalEjercicios = input.required<number>();
  readonly ejerciciosConDolor = input.required<number>();
  readonly progressOffset = input.required<number>();
  readonly mostrarConfetti = input.required<boolean>();
  readonly modoDetallado = input.required<boolean>();

  readonly circumference = 2 * Math.PI * 18;
  readonly confettiPieces = Array.from({ length: 20 }, (_, i) => i);

  readonly progressDashoffset = computed(() => this.progressOffset());

  getConfettiX(index: number): string {
    return `${5 + index * 4.5}%`;
  }

  getConfettiRotation(index: number): string {
    return `${(index * 37) % 360}deg`;
  }
}
