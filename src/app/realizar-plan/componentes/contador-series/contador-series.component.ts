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
          ></div>
        }
      </div>
    </div>
  `,
  styles: `
    .series-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .series-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #4b5563;
    }

    .series-pills {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .pill {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      transition: all 0.3s ease;
    }

    .pill.completada {
      background-color: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
    }

    .pill.actual {
      background-color: #e75c3e;
      box-shadow: 0 0 0 4px rgba(231, 92, 62, 0.2);
      transform: scale(1.2);
    }

    .pill.pendiente {
      background-color: #d1d5db;
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
