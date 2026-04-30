import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  effect,
  OnDestroy,
} from '@angular/core';
import { Ui2ProgressRingComponent } from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-temporizador',
  standalone: true,
  imports: [Ui2ProgressRingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="timer-shell" [class.warning]="esAdvertencia()">
      <ui2-progress-ring
        [size]="ringSize()"
        [stroke]="8"
        [value]="progreso()"
        [color]="esAdvertencia() ? 'var(--warning)' : 'var(--kengo-primary)'"
        [trackColor]="
          esAdvertencia()
            ? 'rgba(245, 158, 11, 0.16)'
            : 'rgba(var(--kengo-primary-rgb), 0.12)'
        "
      >
        <div class="timer-content">
          <span class="timer-value">{{ tiempoFormateado() }}</span>
          <span class="timer-label">{{ label }}</span>
        </div>
      </ui2-progress-ring>
    </div>
  `,
  styles: `
    :host { display: inline-flex; }
    .timer-shell {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      border-radius: 9999px;
      background: var(--cream-50);
      box-shadow: var(--shadow-card);
      transition: box-shadow 0.3s ease, transform 0.3s ease;
    }

    .timer-shell.warning {
      animation: pulse-container 1s ease-in-out infinite;
      box-shadow:
        0 8px 32px rgba(245, 158, 11, 0.25),
        inset 0 0 0 1px rgba(245, 158, 11, 0.35);
    }

    .timer-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      z-index: 1;
    }

    .timer-value {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: clamp(2rem, 8vw, 2.5rem);
      color: var(--ink-900);
      font-variant-numeric: tabular-nums;
      line-height: 1;
      letter-spacing: 0.5px;
      transition: color 0.3s ease;
    }

    .timer-label {
      font-family: Galvji, sans-serif;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--ink-500);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .timer-shell.warning .timer-value {
      color: var(--warning);
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
  @Input() ringSizePx: number | null = null;

  @Output() tiempoAgotado = new EventEmitter<void>();
  @Output() tick = new EventEmitter<number>();

  private _tiempoInicial = signal(0);
  readonly tiempoRestante = signal(0);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly ringSize = computed(() => this.ringSizePx ?? 144);

  readonly progreso = computed(() => {
    const total = this._tiempoInicial();
    const restante = this.tiempoRestante();
    if (total === 0) return 0;
    return Math.max(0, Math.min(1, restante / total));
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
