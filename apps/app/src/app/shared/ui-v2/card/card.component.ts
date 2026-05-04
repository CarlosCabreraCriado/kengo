import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type Ui2CardVariant = 'default' | 'tinted';

/**
 * Surface base de la guía V2 — radius 22px, sombra suave.
 * Variantes:
 *  - `default`: blanco + border `rgba(0,0,0,0.04)` + `--shadow-card`.
 *  - `tinted`: gradient cream-coral + border coral 15%.
 */
@Component({
  selector: 'ui2-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="rootClasses()"
      [style.border-radius.px]="radius()"
      [style.padding.px]="padding()"
    >
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host { display: block; }
    :host > div { height: 100%; box-sizing: border-box; }
    .ui2-card {
      border: 1px solid rgba(0, 0, 0, 0.04);
      background: white;
      box-shadow: var(--shadow-card);
    }
    .ui2-card--tinted {
      border-color: rgba(var(--kengo-primary-rgb), 0.15);
      background: linear-gradient(135deg, #fff5ee, #ffffff);
      box-shadow: 0 4px 14px rgba(var(--kengo-primary-rgb), 0.05);
    }
  `],
})
export class Ui2CardComponent {
  readonly variant = input<Ui2CardVariant>('default');
  readonly padding = input<number>(16);
  readonly radius = input<number>(22);

  readonly rootClasses = computed(() => {
    const v = this.variant();
    return v === 'tinted' ? 'ui2-card ui2-card--tinted' : 'ui2-card';
  });
}
