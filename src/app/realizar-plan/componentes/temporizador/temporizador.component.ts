import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  effect,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-temporizador',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timer-container" [class.warning]="esAdvertencia()">
      <svg class="timer-ring" viewBox="0 0 100 100">
        <!-- Círculo de fondo -->
        <circle
          class="timer-bg"
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke-width="8"
        />
        <!-- Círculo de progreso -->
        <circle
          class="timer-progress"
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke-width="8"
          [style.strokeDasharray]="circunferencia"
          [style.strokeDashoffset]="offsetProgreso()"
        />
      </svg>

      <div class="timer-content">
        <span class="timer-value">{{ tiempoFormateado() }}</span>
        <span class="timer-label">{{ label }}</span>
      </div>
    </div>
  `,
  styles: `
    .timer-container {
      position: relative;
      width: 180px;
      height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .timer-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .timer-bg {
      stroke: rgba(0, 0, 0, 0.1);
    }

    .timer-progress {
      stroke: #e75c3e;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.1s linear;
    }

    .timer-container.warning .timer-progress {
      stroke: #ef4444;
      animation: pulse-ring 1s ease-in-out infinite;
    }

    .timer-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      z-index: 1;
    }

    .timer-value {
      font-size: 2.5rem;
      font-weight: 700;
      color: #1f2937;
      font-variant-numeric: tabular-nums;
    }

    .timer-label {
      font-size: 0.875rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .timer-container.warning .timer-value {
      color: #ef4444;
    }

    @keyframes pulse-ring {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }
  `,
})
export class TemporizadorComponent implements OnDestroy {
  @Input() set tiempoInicial(value: number) {
    this._tiempoInicial.set(value);
    this.tiempoRestante.set(value);
  }

  @Input() label = 'segundos';
  @Input() umbralAdvertencia = 5;
  @Input() autoIniciar = false;

  @Output() tiempoAgotado = new EventEmitter<void>();
  @Output() tick = new EventEmitter<number>();

  private _tiempoInicial = signal(0);
  readonly tiempoRestante = signal(0);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly circunferencia = 2 * Math.PI * 45; // 2πr donde r=45

  readonly offsetProgreso = computed(() => {
    const total = this._tiempoInicial();
    const restante = this.tiempoRestante();
    if (total === 0) return 0;
    const progreso = restante / total;
    return this.circunferencia * (1 - progreso);
  });

  readonly esAdvertencia = computed(() => {
    return this.tiempoRestante() <= this.umbralAdvertencia && this.tiempoRestante() > 0;
  });

  readonly tiempoFormateado = computed(() => {
    const segundos = this.tiempoRestante();
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}`;
  });

  constructor() {
    effect(() => {
      if (this.autoIniciar && this._tiempoInicial() > 0) {
        this.iniciar();
      }
    });
  }

  ngOnDestroy(): void {
    this.detener();
  }

  iniciar(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      const actual = this.tiempoRestante();
      if (actual <= 0) {
        this.detener();
        this.tiempoAgotado.emit();
        return;
      }

      const nuevo = actual - 1;
      this.tiempoRestante.set(nuevo);
      this.tick.emit(nuevo);
    }, 1000);
  }

  detener(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reiniciar(): void {
    this.detener();
    this.tiempoRestante.set(this._tiempoInicial());
  }

  agregarTiempo(segundos: number): void {
    this.tiempoRestante.update((t) => t + segundos);
  }
}
