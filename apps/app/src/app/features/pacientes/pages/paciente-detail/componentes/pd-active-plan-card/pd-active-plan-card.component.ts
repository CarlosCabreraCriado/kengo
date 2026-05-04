import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { Plan } from '../../../../../../../types/global';

function formatYmdShort(s: string | null | undefined): string {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
import {
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2ProgressRingComponent,
} from '../../../../../../shared/ui-v2';
import {
  daysBetweenYMD,
  getMadridDate,
} from '../../../../../../shared/utils/madrid-date.util';

@Component({
  selector: 'app-pd-active-plan-card',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2ProgressRingComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bare()) {
      <ng-container [ngTemplateOutlet]="content"></ng-container>
    } @else {
      <ui2-card [variant]="plan() ? 'tinted' : 'default'" [padding]="20">
        <span class="apc-overline">Plan activo</span>
        <ng-container [ngTemplateOutlet]="content"></ng-container>
      </ui2-card>
    }

    <ng-template #content>
      @if (!plan()) {
        <ui2-empty-state
          icon="event_note"
          title="Sin plan activo"
          message="Asigna un plan de tratamiento para empezar."
          actionLabel="Asignar plan"
          actionIcon="add"
          (action)="crearPlan.emit()"
        />
      } @else {
        <div class="apc-body">
          <ui2-progress-ring
            [size]="92"
            [stroke]="10"
            [value]="progress()"
            color="var(--kengo-primary)"
          >
            <span class="apc-ring__pct">{{ Math.round(progress() * 100) }}%</span>
          </ui2-progress-ring>
          <div class="apc-meta">
            <h3 class="apc-name">{{ plan()!.titulo }}</h3>
            <p class="apc-dates">{{ formatRange() }}</p>
            @if (daysLeft() !== null) {
              <p class="apc-days" [class.apc-days--late]="daysLeft()! < 0">
                @if (daysLeft()! >= 0) {
                  {{ daysLeft() }} día{{ daysLeft() === 1 ? '' : 's' }} restante{{ daysLeft() === 1 ? '' : 's' }}
                } @else {
                  Finalizado hace {{ -daysLeft()! }} día{{ -daysLeft()! === 1 ? '' : 's' }}
                }
              </p>
            }
          </div>
        </div>
        <ui2-button
          variant="primary"
          size="md"
          iconLeft="open_in_new"
          [fullWidth]="true"
          (clicked)="verPlan.emit(plan()!)"
        >
          Abrir plan
        </ui2-button>
      }
    </ng-template>
  `,
  styles: [
    `
      :host { display: block; }
      .apc-overline {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--kengo-primary);
        display: block;
        margin-bottom: 12px;
      }
      .apc-body {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 14px;
      }
      .apc-ring__pct {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 18px;
        font-weight: 700;
        color: var(--ink-900);
        line-height: 1;
      }
      .apc-meta { flex: 1; min-width: 0; }
      .apc-name {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 17px;
        color: var(--ink-900);
        margin: 0;
        line-height: 1.15;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .apc-dates {
        font-size: 11px;
        color: var(--ink-500);
        margin: 4px 0 2px;
        line-height: 1.3;
      }
      .apc-days {
        font-size: 11px;
        font-weight: 700;
        color: var(--success);
        margin: 0;
        line-height: 1.3;
      }
      .apc-days--late { color: var(--ink-400); }
    `,
  ],
})
export class PdActivePlanCardComponent {
  readonly plan = input<Plan | null>(null);
  readonly bare = input<boolean>(false);
  readonly verPlan = output<Plan>();
  readonly crearPlan = output<void>();

  readonly Math = Math;

  readonly progress = computed<number>(() => {
    const p = this.plan();
    if (!p?.fechaInicio || !p?.fechaFin) return 0;
    const inicio = p.fechaInicio;
    const fin = p.fechaFin;
    const hoy = getMadridDate();
    const total = daysBetweenYMD(inicio, fin);
    if (total <= 0) return 1;
    const transcurrido = daysBetweenYMD(inicio, hoy);
    return Math.max(0, Math.min(1, transcurrido / total));
  });

  readonly daysLeft = computed<number | null>(() => {
    const p = this.plan();
    if (!p?.fechaFin) return null;
    return daysBetweenYMD(getMadridDate(), p.fechaFin);
  });

  formatRange(): string {
    const p = this.plan();
    if (!p) return '';
    const a = formatYmdShort(p.fechaInicio);
    const b = formatYmdShort(p.fechaFin);
    return a && b ? `${a} → ${b}` : a || b || '';
  }
}
