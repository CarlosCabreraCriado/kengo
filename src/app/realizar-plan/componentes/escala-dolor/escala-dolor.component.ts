import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-escala-dolor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="escala-container">
      <label class="escala-label">{{ label }}</label>

      <div class="escala-visual">
        <div class="escala-bar">
          @for (valor of valores; track valor) {
            <button
              type="button"
              class="escala-btn"
              [class.selected]="valorSeleccionado() === valor"
              [style.backgroundColor]="getColor(valor)"
              [style.borderColor]="valorSeleccionado() === valor ? getColor(valor) : 'transparent'"
              (click)="seleccionar(valor)"
            >
              {{ valor }}
            </button>
          }
        </div>

        <div class="escala-labels">
          <span class="emoji">😊</span>
          <span class="texto">Sin dolor</span>
          <span class="spacer"></span>
          <span class="texto">Dolor intenso</span>
          <span class="emoji">😣</span>
        </div>
      </div>

      @if (valorSeleccionado() !== null) {
        <div class="valor-display" [style.color]="getColor(valorSeleccionado()!)">
          {{ getDescripcion(valorSeleccionado()!) }}
        </div>
      }
    </div>
  `,
  styles: `
    .escala-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
    }

    .escala-label {
      font-size: 1rem;
      font-weight: 600;
      color: #1f2937;
      text-align: center;
    }

    .escala-visual {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .escala-bar {
      display: flex;
      justify-content: space-between;
      gap: 4px;
    }

    .escala-btn {
      flex: 1;
      aspect-ratio: 1;
      max-width: 40px;
      border-radius: 8px;
      border: 3px solid transparent;
      font-size: 0.875rem;
      font-weight: 600;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .escala-btn:hover {
      transform: scale(1.1);
    }

    .escala-btn.selected {
      transform: scale(1.15);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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
      font-size: 0.75rem;
      color: #6b7280;
    }

    .escala-labels .spacer {
      flex: 1;
    }

    .valor-display {
      text-align: center;
      font-size: 0.875rem;
      font-weight: 500;
      padding: 8px 16px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 8px;
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

  private readonly colores: Record<number, string> = {
    0: '#22c55e',
    1: '#4ade80',
    2: '#86efac',
    3: '#a3e635',
    4: '#facc15',
    5: '#fbbf24',
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
    return this.colores[valor] || '#6b7280';
  }

  getDescripcion(valor: number): string {
    return this.descripciones[valor] || '';
  }

  seleccionar(valor: number): void {
    this._valor.set(valor);
    this.valorChange.emit(valor);
  }
}
