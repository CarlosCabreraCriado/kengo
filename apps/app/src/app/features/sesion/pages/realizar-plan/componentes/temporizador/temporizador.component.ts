import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  effect,
  inject,
  OnDestroy,
} from '@angular/core';
import {
  Ui2ProgressRingComponent,
  Ui2ButtonComponent,
} from '../../../../../../shared/ui-v2';
import { HapticsService } from '../../../../../../core/services/haptics.service';

type EstadoTemporizador =
  | 'idle'
  | 'preparando'
  | 'corriendo'
  | 'pausado'
  | 'agotado';

@Component({
  selector: 'app-temporizador',
  standalone: true,
  imports: [Ui2ProgressRingComponent, Ui2ButtonComponent],
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
          @switch (estado()) {
            @case ('idle') {
              <ui2-button
                variant="primary"
                size="sm"
                iconLeft="play_arrow"
                (clicked)="solicitarInicio()"
              >
                Iniciar
              </ui2-button>
            }
            @case ('preparando') {
              <span class="timer-prep">{{ cuentaPreparacion() }}</span>
              <span class="timer-label">prepárate</span>
            }
            @default {
              <span class="timer-value">{{ tiempoFormateado() }}</span>
              <span class="timer-label">{{ label }}</span>
            }
          }
        </div>
      </ui2-progress-ring>

      @if (interactivo() && (estado() === 'corriendo' || estado() === 'pausado')) {
        <div class="timer-toggle">
          <ui2-button
            variant="secondary"
            size="sm"
            [iconOnly]="true"
            [iconLeft]="estado() === 'pausado' ? 'play_arrow' : 'pause'"
            (clicked)="pausarReanudar()"
          >
            <span class="sr-only">{{
              estado() === 'pausado' ? 'Reanudar' : 'Pausar'
            }}</span>
          </ui2-button>
        </div>
      }
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

    .timer-prep {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: clamp(2.5rem, 10vw, 3.25rem);
      color: var(--kengo-primary);
      font-variant-numeric: tabular-nums;
      line-height: 1;
      animation: prep-pop 1s ease-in-out infinite;
    }

    @keyframes prep-pop {
      0% {
        transform: scale(0.7);
        opacity: 0.4;
      }
      40%,
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    .timer-toggle {
      position: absolute;
      bottom: -12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
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
  /** Se emite una única vez cuando el temporizador arranca de verdad. */
  @Output() iniciado = new EventEmitter<void>();

  private readonly haptics = inject(HapticsService);

  private _tiempoInicial = signal(0);
  readonly tiempoRestante = signal(0);
  readonly estado = signal<EstadoTemporizador>('idle');
  readonly cuentaPreparacion = signal(0);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private prepIntervalId: ReturnType<typeof setInterval> | null = null;
  private yaIniciado = false;

  readonly ringSize = computed(() => this.ringSizePx ?? 144);

  /** El modo interactivo (Iniciar/pausa) solo aplica cuando no auto-arranca. */
  readonly interactivo = computed(() => !this.autoIniciar);

  readonly progreso = computed(() => {
    if (this.estado() === 'idle' || this.estado() === 'preparando') return 1;
    const total = this._tiempoInicial();
    const restante = this.tiempoRestante();
    if (total === 0) return 0;
    return Math.max(0, Math.min(1, restante / total));
  });

  readonly esAdvertencia = computed(() => {
    return (
      this.estado() === 'corriendo' &&
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
        this.arrancar();
      }
    });
  }

  ngOnDestroy(): void {
    this.detener();
    this.limpiarPreparacion();
  }

  /** Inicia la cuenta atrás de 3 antes de arrancar el ejercicio (modo manual). */
  solicitarInicio(): void {
    if (this.estado() !== 'idle') return;

    this.estado.set('preparando');
    this.cuentaPreparacion.set(3);
    void this.haptics.impact('light');

    this.prepIntervalId = setInterval(() => {
      const restante = this.cuentaPreparacion() - 1;
      if (restante <= 0) {
        this.limpiarPreparacion();
        this.arrancar();
        return;
      }
      this.cuentaPreparacion.set(restante);
      void this.haptics.impact('light');
    }, 1000);
  }

  pausarReanudar(): void {
    if (this.estado() === 'corriendo') {
      this.pausar();
    } else if (this.estado() === 'pausado') {
      this.reanudar();
    }
  }

  pausar(): void {
    if (this.estado() !== 'corriendo') return;
    this.detener();
    this.estado.set('pausado');
  }

  reanudar(): void {
    if (this.estado() !== 'pausado') return;
    this.estado.set('corriendo');
    this.arrancarInterval();
  }

  detener(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reiniciar(): void {
    this.detener();
    this.limpiarPreparacion();
    this.tiempoRestante.set(this._tiempoInicial());
    this.yaIniciado = false;
    this.estado.set(this.autoIniciar ? 'corriendo' : 'idle');
  }

  agregarTiempo(segundos: number): void {
    this.tiempoRestante.update((t: number) => t + segundos);
  }

  /** Arranca el conteo real; emite `iniciado` la primera vez. */
  private arrancar(): void {
    if (this.intervalId) return;
    this.estado.set('corriendo');
    if (!this.yaIniciado) {
      this.yaIniciado = true;
      this.iniciado.emit();
    }
    this.arrancarInterval();
  }

  private arrancarInterval(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      const actual = this.tiempoRestante();
      if (actual <= 0) {
        this.detener();
        this.estado.set('agotado');
        this.tiempoAgotado.emit();
        return;
      }

      const nuevo = actual - 1;
      this.tiempoRestante.set(nuevo);
      this.tick.emit(nuevo);
    }, 1000);
  }

  private limpiarPreparacion(): void {
    if (this.prepIntervalId) {
      clearInterval(this.prepIntervalId);
      this.prepIntervalId = null;
    }
  }
}
