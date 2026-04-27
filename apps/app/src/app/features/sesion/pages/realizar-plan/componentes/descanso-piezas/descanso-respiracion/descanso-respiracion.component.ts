import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TemporizadorComponent } from '../../temporizador/temporizador.component';

@Component({
  selector: 'app-descanso-respiracion',
  standalone: true,
  imports: [TemporizadorComponent],
  templateUrl: './descanso-respiracion.component.html',
  styleUrl: './descanso-respiracion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DescansoRespiracionComponent implements OnInit {
  readonly tiempoInicial = input.required<number>();
  readonly umbralAdvertencia = input(5);

  readonly tiempoAgotado = output<void>();
  readonly tick = output<number>();

  readonly breathPhase = signal<'inhale' | 'exhale'>('inhale');
  readonly isWarning = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly temporizador = viewChild(TemporizadorComponent);

  ngOnInit(): void {
    const intervalId = setInterval(() => {
      this.breathPhase.update((phase) => (phase === 'inhale' ? 'exhale' : 'inhale'));
    }, 4000);

    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  onTick(segundosRestantes: number): void {
    this.isWarning.set(segundosRestantes <= this.umbralAdvertencia() && segundosRestantes > 0);
    this.tick.emit(segundosRestantes);
  }

  onTiempoAgotado(): void {
    this.tiempoAgotado.emit();
  }

  agregarTiempo(segundos: number): void {
    this.temporizador()?.agregarTiempo(segundos);
  }
}
