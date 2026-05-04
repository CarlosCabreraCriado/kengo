import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  Ui2CardComponent,
  Ui2WeeklyBar,
  Ui2WeeklyBarsComponent,
} from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-pd-weekly-bars-card',
  standalone: true,
  imports: [NgTemplateOutlet, Ui2CardComponent, Ui2WeeklyBarsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bare()) {
      <ng-container [ngTemplateOutlet]="content"></ng-container>
    } @else {
      <ui2-card [padding]="20">
        <header class="wbc-head">
          <div class="wbc-head__text">
            <span class="wbc-overline">Adherencia</span>
            <h3 class="wbc-title">Últimas {{ weeks().length }} semanas</h3>
          </div>
          @if (rangoLabel()) {
            <span class="wbc-range">{{ rangoLabel() }}</span>
          }
        </header>
        <ng-container [ngTemplateOutlet]="content"></ng-container>
      </ui2-card>
    }

    <ng-template #content>
      @if (weeks().length > 0) {
        <ui2-weekly-bars [data]="bars()" />
      } @else {
        <p class="wbc-empty">Sin datos para este período.</p>
      }
      <p class="wbc-footer">
        Promedio del período: <strong>{{ promedio() }}%</strong>
      </p>
    </ng-template>
  `,
  styles: [
    `
      :host { display: block; }
      .wbc-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }
      .wbc-head__text { min-width: 0; }
      .wbc-overline {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--kengo-primary);
      }
      .wbc-title {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 22px;
        color: var(--ink-900);
        margin: 4px 0 0;
        line-height: 1;
      }
      .wbc-range {
        font-size: 11px;
        color: var(--ink-500);
        font-weight: 600;
      }
      .wbc-empty {
        font-size: 12px;
        color: var(--ink-500);
        text-align: center;
        padding: 24px 0;
        margin: 0;
      }
      .wbc-footer {
        margin: 14px 0 0;
        font-size: 11px;
        color: var(--ink-500);
      }
      .wbc-footer strong {
        color: var(--ink-900);
        font-weight: 700;
      }
    `,
  ],
})
export class PdWeeklyBarsCardComponent {
  readonly weeks = input<{ semana: string; porcentaje: number }[]>([]);
  readonly rangoLabel = input<string | null>(null);
  readonly bare = input<boolean>(false);

  readonly bars = computed<Ui2WeeklyBar[]>(() =>
    this.weeks().map((w) => ({ label: w.semana, value: w.porcentaje })),
  );

  readonly promedio = computed<number>(() => {
    const arr = this.weeks();
    if (arr.length === 0) return 0;
    const sum = arr.reduce((acc, w) => acc + w.porcentaje, 0);
    return Math.round(sum / arr.length);
  });
}
