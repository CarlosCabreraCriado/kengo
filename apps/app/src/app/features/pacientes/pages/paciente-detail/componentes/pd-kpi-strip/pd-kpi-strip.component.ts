import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  Ui2ProgressRingComponent,
  Ui2TrendComponent,
} from '../../../../../../shared/ui-v2';

export interface PdKpiVm {
  label: string;
  value: string;
  unit?: string | null;
  /** 0-1 para el anillo */
  ringValue: number;
  ringColor?: string;
  /** Delta vs período anterior (signo crudo). */
  trend?: number | null;
  /** True si menos = mejor (ej. dolor). */
  trendInverse?: boolean;
  trendSuffix?: string;
  trendDecimals?: number;
}

@Component({
  selector: 'app-pd-kpi-strip',
  standalone: true,
  imports: [Ui2ProgressRingComponent, Ui2TrendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pd-kpis">
      @for (kpi of kpis(); track kpi.label) {
        <article class="pd-kpi">
          <ui2-progress-ring
            [size]="64"
            [stroke]="8"
            [value]="kpi.ringValue"
            [color]="kpi.ringColor || 'var(--kengo-primary)'"
          >
            <span class="pd-kpi__ring-icon" aria-hidden="true">
              <span class="material-symbols-outlined">{{ ringIcon(kpi.label) }}</span>
            </span>
          </ui2-progress-ring>
          <div class="pd-kpi__meta">
            <span class="pd-kpi__label">{{ kpi.label }}</span>
            <span class="pd-kpi__value">
              {{ kpi.value }}
              @if (kpi.unit) {
                <span class="pd-kpi__unit">{{ kpi.unit }}</span>
              }
            </span>
            @if (kpi.trend !== null && kpi.trend !== undefined) {
              <ui2-trend
                [value]="kpi.trend"
                [inverse]="kpi.trendInverse ?? false"
                [suffix]="kpi.trendSuffix ?? ''"
                [decimals]="kpi.trendDecimals ?? 0"
                size="sm"
              />
            }
          </div>
        </article>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .pd-kpis {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      @media (max-width: 768px) {
        .pd-kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .pd-kpi {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.04);
        border-radius: 18px;
        box-shadow: var(--shadow-card);
      }
      .pd-kpi__ring-icon .material-symbols-outlined {
        font-size: 20px;
        color: var(--kengo-primary);
      }
      .pd-kpi__meta {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .pd-kpi__label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: var(--ink-500);
        line-height: 1;
      }
      .pd-kpi__value {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 26px;
        line-height: 1;
        color: var(--ink-900);
      }
      .pd-kpi__unit {
        font-family: Galvji, sans-serif;
        font-size: 12px;
        font-weight: 700;
        color: var(--ink-500);
        margin-left: 2px;
      }
    `,
  ],
})
export class PdKpiStripComponent {
  readonly kpis = input<PdKpiVm[]>([]);

  ringIcon(label: string): string {
    const norm = label.toLowerCase();
    if (norm.includes('adheren')) return 'task_alt';
    if (norm.includes('sesion')) return 'event_available';
    if (norm.includes('dolor')) return 'monitor_heart';
    if (norm.includes('racha')) return 'local_fire_department';
    return 'trending_up';
  }
}
