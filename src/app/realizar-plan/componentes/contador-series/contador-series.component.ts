import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-contador-series',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="series-container">
      <span class="series-label">Serie {{ serieActual() }} de {{ totalSeries() }}</span>
      <div class="series-pills">
        @for (serie of seriesArray(); track serie) {
          <div
            class="pill"
            [class.completada]="serie < serieActual()"
            [class.actual]="serie === serieActual()"
            [class.pendiente]="serie > serieActual()"
          >
            @if (serie < serieActual()) {
              <span class="check-icon">✓</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .series-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
    }

    .series-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      letter-spacing: 0.02em;
    }

    .series-pills {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .pill {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 2px solid transparent;
    }

    .pill.completada {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .check-icon {
      color: white;
      font-size: 0.875rem;
      font-weight: 700;
    }

    .pill.actual {
      background: linear-gradient(135deg, #e75c3e 0%, #d14d31 100%);
      box-shadow:
        0 0 0 4px rgba(231, 92, 62, 0.2),
        0 4px 16px rgba(231, 92, 62, 0.3);
      transform: scale(1.15);
      animation: pulse-pill 2s ease-in-out infinite;
    }

    .pill.pendiente {
      background: rgba(0, 0, 0, 0.05);
      border-color: rgba(0, 0, 0, 0.1);
    }

    @keyframes pulse-pill {
      0%, 100% {
        box-shadow:
          0 0 0 4px rgba(231, 92, 62, 0.2),
          0 4px 16px rgba(231, 92, 62, 0.3);
      }
      50% {
        box-shadow:
          0 0 0 6px rgba(231, 92, 62, 0.15),
          0 4px 20px rgba(231, 92, 62, 0.4);
      }
    }
  `,
})
export class ContadorSeriesComponent {
  @Input() set serie(value: number) {
    this._serieActual.set(value);
  }

  @Input() set total(value: number) {
    this._totalSeries.set(value);
  }

  private _serieActual = signal(1);
  private _totalSeries = signal(1);

  readonly serieActual = computed(() => this._serieActual());
  readonly totalSeries = computed(() => this._totalSeries());

  readonly seriesArray = computed(() => {
    const total = this._totalSeries();
    return Array.from({ length: total }, (_, i) => i + 1);
  });
}
