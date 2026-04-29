import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Cuadrado tinted con icono Material Symbol centrado.
 * Background = color con alpha 12% (`{color}1f`), color del icono = `color`.
 */
@Component({
  selector: 'ui2-icon-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="ui2-icon-badge"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.border-radius.px]="radius()"
      [style.background]="bg()"
      [style.color]="color()"
    >
      <span
        class="material-symbols-outlined"
        [style.font-size.px]="iconSizePx()"
        aria-hidden="true"
      >{{ icon() }}</span>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }
    .ui2-icon-badge {
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .ui2-icon-badge .material-symbols-outlined {
      line-height: 1;
    }
  `],
})
export class Ui2IconBadgeComponent {
  readonly icon = input.required<string>();
  readonly color = input<string>('var(--kengo-primary)');
  readonly size = input<number>(36);
  readonly radius = input<number>(10);
  readonly iconSize = input<number | null>(null);

  readonly iconSizePx = computed(() => {
    const explicit = this.iconSize();
    if (explicit != null) return explicit;
    return Math.round(this.size() * 0.55);
  });

  readonly bg = computed(() => {
    const c = this.color();
    if (c.startsWith('var(')) {
      return `color-mix(in srgb, ${c} 12%, transparent)`;
    }
    return `${c}1f`;
  });
}
