import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Pequeño punto de color + texto inline.
 * Para "Disponible", niveles de dolor, estados online, etc.
 */
@Component({
  selector: 'ui2-status-dot',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ui2-status-dot" [style.color]="color()">
      <span
        class="ui2-status-dot__dot"
        [style.background]="color()"
        [style.width.px]="size()"
        [style.height.px]="size()"
      ></span>
      <ng-content></ng-content>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    .ui2-status-dot {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
    }
    .ui2-status-dot__dot {
      border-radius: 50%;
      flex-shrink: 0;
    }
  `],
})
export class Ui2StatusDotComponent {
  readonly color = input<string>('var(--success)');
  readonly size = input<number>(6);
}
