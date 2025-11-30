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
      padding: 2rem;
      width: clamp(5rem, 25vw, 9rem);
      height: clamp(5rem, 25vw, 9rem);
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 50%;
      box-shadow:
        0 8px 32px rgba(231, 92, 62, 0.15),
        inset 0 0 0 1px rgba(255, 255, 255, 0.5);
      transition: all 0.3s ease;
    }

    .timer-container:hover {
      transform: scale(1.02);
      box-shadow:
        0 12px 40px rgba(231, 92, 62, 0.2),
        inset 0 0 0 1px rgba(255, 255, 255, 0.6);
    }

    .timer-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
      filter: drop-shadow(0 2px 4px rgba(231, 92, 62, 0.3));
    }

    .timer-bg {
      stroke: rgba(231, 92, 62, 0.1);
    }

    .timer-progress {
      stroke: #e75c3e;
      stroke-linecap: round;
      transition:
        stroke-dashoffset 0.1s linear,
        stroke 0.3s ease;
    }

    .timer-container.warning {
      animation: pulse-container 1s ease-in-out infinite;
      box-shadow:
        0 8px 32px rgba(239, 192, 72, 0.3),
        inset 0 0 0 1px rgba(239, 192, 72, 0.5);
    }

    .timer-container.warning .timer-progress {
      stroke: #efc048;
    }

    .timer-container.warning .timer-ring {
      filter: drop-shadow(0 2px 8px rgba(239, 192, 72, 0.5));
    }

    .timer-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      z-index: 1;
    }

    .timer-value {
      font-size: clamp(2rem, 8vw, 2.5rem);
      font-weight: 700;
      color: #1f2937;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      transition: color 0.3s ease;
    }

    .timer-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .timer-container.warning .timer-value {
      color: #efc048;
    }

    @keyframes pulse-container {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.03);
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
    return (
      this.tiempoRestante() <= this.umbralAdvertencia &&
      this.tiempoRestante() > 0
    );
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
