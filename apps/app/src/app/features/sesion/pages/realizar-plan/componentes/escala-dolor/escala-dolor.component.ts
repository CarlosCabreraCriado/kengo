import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
} from '@angular/core';
import {
  Ui2CardComponent,
  Ui2SectionLabelComponent,
} from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-escala-dolor',
  standalone: true,
  imports: [Ui2CardComponent, Ui2SectionLabelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui2-card [padding]="16">
      <div class="escala-container">
        <ui2-section-label color="var(--ink-700)">{{ label }}</ui2-section-label>

        <div class="escala-visual">
          <div class="escala-bar">
            @for (valor of valores; track valor) {
              <button
                type="button"
                class="escala-btn"
                [class.selected]="valorSeleccionado() === valor"
                [style.backgroundColor]="getColor(valor)"
                (click)="seleccionar(valor)"
                [attr.aria-label]="'Dolor ' + valor + ' de 10'"
                [attr.aria-pressed]="valorSeleccionado() === valor"
              >
                {{ valor }}
              </button>
            }
          </div>

          <div class="escala-labels">
            <span class="emoji" aria-hidden="true">😊</span>
            <span class="texto">Sin dolor</span>
            <span class="spacer"></span>
            <span class="texto">Dolor intenso</span>
            <span class="emoji" aria-hidden="true">😣</span>
          </div>
        </div>

        @if (valorSeleccionado() !== null) {
          <div
            class="valor-display"
            [style.color]="getColor(valorSeleccionado()!)"
          >
            {{ getDescripcion(valorSeleccionado()!) }}
          </div>
        }
      </div>
    </ui2-card>
  `,
  styles: `
    :host { display: block; }

    .escala-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
    }

    .escala-visual {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .escala-bar {
      display: flex;
      justify-content: space-between;
      gap: 4px;
      padding: 6px;
      background: var(--cream-100);
      border-radius: 14px;
    }

    .escala-btn {
      flex: 1;
      aspect-ratio: 1;
      max-width: 28px;
      border-radius: 9px;
      border: 2px solid transparent;
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 0.75rem;
      color: white;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .escala-btn:hover {
      transform: scale(1.15) translateY(-2px);
      z-index: 1;
    }

    .escala-btn:active {
      transform: scale(1.05);
    }

    .escala-btn.selected {
      transform: scale(1.2) translateY(-4px);
      border-color: white;
      box-shadow:
        0 6px 20px rgba(0, 0, 0, 0.25),
        0 0 0 3px rgba(255, 255, 255, 0.3);
      z-index: 2;
    }

    .escala-labels {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px;
    }

    .escala-labels .emoji {
      font-size: 1.25rem;
    }

    .escala-labels .texto {
      font-family: Galvji, sans-serif;
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--ink-500);
    }

    .escala-labels .spacer {
      flex: 1;
    }

    .valor-display {
      text-align: center;
      font-family: Galvji, sans-serif;
      font-size: 0.875rem;
      font-weight: 700;
      padding: 10px 16px;
      background: var(--cream-50);
      border-radius: 14px;
      box-shadow: var(--shadow-card);
      transition: all 0.3s ease;
    }
  `,
})
export class EscalaDolorComponent {
  @Input() label = '¿Sentiste dolor?';
  @Input() set valor(v: number | null) {
    this._valor.set(v);
  }

  @Output() valorChange = new EventEmitter<number>();

  private _valor = signal<number | null>(null);
  readonly valorSeleccionado = computed(() => this._valor());

  readonly valores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Mapping a tonos semánticos: 0-3 verde (success-like), 4-6 ámbar (warning), 7-10 rojo (danger).
  private readonly colores: Record<number, string> = {
    0: '#22c55e',
    1: '#34d399',
    2: '#5eead4',
    3: '#a3e635',
    4: '#facc15',
    5: '#f59e0b',
    6: '#fb923c',
    7: '#f97316',
    8: '#ef4444',
    9: '#dc2626',
    10: '#b91c1c',
  };

  private readonly descripciones: Record<number, string> = {
    0: 'Sin dolor',
    1: 'Dolor mínimo',
    2: 'Molestia leve',
    3: 'Dolor leve',
    4: 'Dolor moderado bajo',
    5: 'Dolor moderado',
    6: 'Dolor moderado alto',
    7: 'Dolor intenso',
    8: 'Dolor muy intenso',
    9: 'Dolor severo',
    10: 'Dolor máximo',
  };

  getColor(valor: number): string {
    return this.colores[valor] || 'var(--ink-500)';
  }

  getDescripcion(valor: number): string {
    return this.descripciones[valor] || '';
  }

  seleccionar(valor: number): void {
    this._valor.set(valor);
    this.valorChange.emit(valor);
  }
}
