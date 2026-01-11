import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// Angular Material
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-contador-series',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="flex flex-col items-center gap-2 rounded-2xl bg-white/60 px-6 py-3 shadow-md backdrop-blur-sm">
      <span class="text-sm font-semibold tracking-wide text-zinc-700">
        Serie {{ serieActual() }} de {{ totalSeries() }}
      </span>
      <div class="flex items-center gap-3">
        @for (serie of seriesArray(); track serie) {
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-transparent transition-all duration-300"
            [class]="getPillClasses(serie)"
          >
            @if (serie < serieActual()) {
              <mat-icon class="material-symbols-outlined !text-sm text-white">check</mat-icon>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .pill-completada {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    }

    .pill-actual {
      background: linear-gradient(135deg, #e75c3e 0%, #d14d31 100%);
      box-shadow: 0 0 0 3px rgba(231, 92, 62, 0.2), 0 2px 10px rgba(231, 92, 62, 0.3);
      transform: scale(1.1);
      animation: pulse-pill 2s ease-in-out infinite;
    }

    .pill-pendiente {
      background: rgba(0, 0, 0, 0.05);
      border-color: rgba(0, 0, 0, 0.1);
    }

    @keyframes pulse-pill {
      0%, 100% {
        box-shadow: 0 0 0 3px rgba(231, 92, 62, 0.2), 0 2px 10px rgba(231, 92, 62, 0.3);
      }
      50% {
        box-shadow: 0 0 0 4px rgba(231, 92, 62, 0.15), 0 2px 12px rgba(231, 92, 62, 0.4);
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

  getPillClasses(serie: number): string {
    if (serie < this.serieActual()) {
      return 'pill-completada';
    }
    if (serie === this.serieActual()) {
      return 'pill-actual';
    }
    return 'pill-pendiente';
  }
}
