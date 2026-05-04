import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { Plan } from '../../../../../../../types/global';
import {
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2PillComponent,
  Ui2PillVariant,
  Ui2SpinnerComponent,
} from '../../../../../../shared/ui-v2';

const ESTADO_VARIANT: Record<string, Ui2PillVariant> = {
  borrador: 'neutral',
  activo: 'success',
  completado: 'soft',
  cancelado: 'danger',
};

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  activo: 'Activo',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

@Component({
  selector: 'app-pd-plans-list',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2PillComponent,
    Ui2SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bare()) {
      <ng-container [ngTemplateOutlet]="content"></ng-container>
    } @else {
      <ui2-card [padding]="20">
        <header class="pln-head">
          <span class="pln-overline">Planes asignados</span>
          <h3 class="pln-title">{{ title() }}</h3>
        </header>
        <ng-container [ngTemplateOutlet]="content"></ng-container>
      </ui2-card>
    }

    <ng-template #content>
      @if (isLoading()) {
        <div class="pln-loading"><ui2-spinner /></div>
      } @else if (planes().length === 0) {
        <ui2-empty-state
          icon="assignment"
          title="Sin planes asignados"
          message="Crea el primer plan de tratamiento."
          actionLabel="Crear plan"
          actionIcon="add"
          (action)="crearPlan.emit()"
        />
      } @else {
        <ul class="pln-list">
          @for (plan of planes(); track plan.id) {
            <li
              class="pln-card"
              [class.pln-card--activo]="plan.estado === 'activo'"
              role="button"
              tabindex="0"
              (click)="verPlan.emit(plan)"
              (keyup.enter)="verPlan.emit(plan)"
            >
              <div class="pln-card__top">
                <span class="pln-card__name">{{ plan.titulo }}</span>
                <ui2-pill [variant]="estadoVariant(plan.estado)" size="sm">
                  {{ estadoLabel(plan.estado) }}
                </ui2-pill>
              </div>
              <div class="pln-card__dates">
                <span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>
                <span>{{ formatRange(plan) }}</span>
              </div>
            </li>
          }
        </ul>
      }
    </ng-template>
  `,
  styles: [
    `
      :host { display: block; }
      .pln-head { margin-bottom: 14px; }
      .pln-overline {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--kengo-primary);
      }
      .pln-title {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 22px;
        color: var(--ink-900);
        margin: 4px 0 0;
        line-height: 1;
      }
      .pln-loading { display: grid; place-items: center; padding: 16px; }
      .pln-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .pln-card {
        padding: 14px;
        border-radius: 14px;
        background: rgba(0, 0, 0, 0.025);
        border: 1px solid rgba(0, 0, 0, 0.04);
        cursor: pointer;
        transition: background 160ms, transform 160ms;
      }
      .pln-card:hover { background: rgba(0, 0, 0, 0.04); transform: translateY(-1px); }
      .pln-card--activo {
        background: linear-gradient(135deg, rgba(var(--kengo-primary-rgb), 0.08), rgba(var(--kengo-primary-rgb), 0.02));
        border-color: rgba(var(--kengo-primary-rgb), 0.18);
      }
      .pln-card__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .pln-card__name {
        font-size: 13px;
        font-weight: 700;
        color: var(--ink-900);
        text-transform: uppercase;
        letter-spacing: 0.3px;
        line-height: 1.2;
      }
      .pln-card__dates {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        font-size: 11px;
        color: var(--ink-500);
      }
      .pln-card__dates .material-symbols-outlined { font-size: 14px; }
    `,
  ],
})
export class PdPlansListComponent {
  readonly planes = input<Plan[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly bare = input<boolean>(false);
  readonly verPlan = output<Plan>();
  readonly crearPlan = output<void>();

  readonly title = computed(() => {
    const n = this.planes().length;
    return `${n} plan${n === 1 ? '' : 'es'}`;
  });

  estadoVariant(estado: string | undefined): Ui2PillVariant {
    return ESTADO_VARIANT[estado ?? ''] ?? 'neutral';
  }

  estadoLabel(estado: string | undefined): string {
    return ESTADO_LABEL[estado ?? ''] ?? 'Plan';
  }

  formatRange(plan: Plan): string {
    const fmt = (s: string | null | undefined): string => {
      if (!s) return '';
      const [y, m, d] = s.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d, 12));
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };
    const a = fmt(plan.fechaInicio);
    const b = fmt(plan.fechaFin);
    return a && b ? `${a} → ${b}` : a || b || '—';
  }
}
