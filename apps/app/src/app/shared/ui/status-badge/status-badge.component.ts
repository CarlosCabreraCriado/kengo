import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type StatusBadgeStatus =
  | 'borrador'
  | 'activo'
  | 'completado'
  | 'cancelado'
  | 'pausado'
  | 'pendiente';

const LABELS: Record<StatusBadgeStatus, string> = {
  borrador: 'Borrador',
  activo: 'Activo',
  completado: 'Completado',
  cancelado: 'Cancelado',
  pausado: 'Pausado',
  pendiente: 'Pendiente',
};

const COLORS: Record<StatusBadgeStatus, string> = {
  borrador: 'bg-zinc-100 text-zinc-600',
  activo: 'bg-green-100 text-green-700',
  completado: 'bg-blue-100 text-blue-700',
  cancelado: 'bg-red-100 text-red-600',
  pausado: 'bg-amber-100 text-amber-700',
  pendiente: 'bg-zinc-100 text-zinc-600',
};

@Component({
  selector: 'ui-status-badge',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClasses()">{{ label() }}</span>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }
  `],
})
export class StatusBadgeComponent {
  status = input.required<StatusBadgeStatus>();
  customLabel = input<string | undefined>(undefined);

  label = computed(() => this.customLabel() ?? LABELS[this.status()]);

  badgeClasses = computed(
    () =>
      `inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${COLORS[this.status()]}`,
  );
}
