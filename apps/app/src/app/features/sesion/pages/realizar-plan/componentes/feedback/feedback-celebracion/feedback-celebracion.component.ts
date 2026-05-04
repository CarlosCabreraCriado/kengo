import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Ui2ProgressRingComponent } from '../../../../../../../shared/ui-v2';

@Component({
  selector: 'app-feedback-celebracion',
  standalone: true,
  imports: [Ui2ProgressRingComponent],
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

  readonly confettiPieces = Array.from({ length: 20 }, (_, i) => i);

  // Convierte el dashoffset que llega del padre (calculado sobre 2π·18) a value [0,1]
  // que entiende ui2-progress-ring. La circunferencia base es 2π·18 ≈ 113.097.
  readonly progressValue = computed(() => {
    const total = this.totalEjercicios();
    if (total === 0) return 0;
    return Math.max(0, Math.min(1, this.ejerciciosConDolor() / total));
  });

  getConfettiX(index: number): string {
    return `${5 + index * 4.5}%`;
  }

  getConfettiRotation(index: number): string {
    return `${(index * 37) % 360}deg`;
  }
}
