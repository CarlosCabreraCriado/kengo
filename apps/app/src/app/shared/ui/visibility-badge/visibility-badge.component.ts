import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type VisibilityType = 'privado' | 'clinica' | 'publico';

const META: Record<VisibilityType, { icon: string; label: string; classes: string }> = {
  privado: {
    icon: 'lock',
    label: 'Privada',
    classes: 'bg-zinc-100 text-zinc-700',
  },
  clinica: {
    icon: 'domain',
    label: 'Clínica',
    classes: 'bg-amber-100 text-amber-700',
  },
  publico: {
    icon: 'public',
    label: 'Pública',
    classes: 'bg-emerald-100 text-emerald-700',
  },
};

@Component({
  selector: 'ui-visibility-badge',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClasses()">
      <span class="material-symbols-outlined text-xs">{{ icon() }}</span>
      {{ label() }}
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }
  `],
})
export class VisibilityBadgeComponent {
  visibility = input.required<VisibilityType>();

  private meta = computed(() => META[this.visibility()]);
  icon = computed(() => this.meta().icon);
  label = computed(() => this.meta().label);

  badgeClasses = computed(
    () =>
      `inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${this.meta().classes}`,
  );
}
