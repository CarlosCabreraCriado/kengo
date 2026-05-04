import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Etiqueta de sección — uppercase, 11px, peso 700, tracking 1px.
 * Acción opcional a la derecha (texto coral clicable).
 */
@Component({
  selector: 'ui2-section-label',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-section-label">
      <span class="ui2-section-label__text" [style.color]="color()">
        <ng-content></ng-content>
      </span>
      @if (action()) {
        <button
          type="button"
          class="ui2-section-label__action"
          (click)="actionClick.emit()"
        >{{ action() }}</button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-section-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px;
      margin-bottom: 10px;
    }
    .ui2-section-label__text {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      line-height: 1;
    }
    .ui2-section-label__action {
      font-size: 11px;
      font-weight: 700;
      color: var(--kengo-primary);
      background: transparent;
      border: 0;
      padding: 0;
      cursor: pointer;
      letter-spacing: 0.2px;
    }
    .ui2-section-label__action:hover { color: var(--kengo-primary-dark); }
  `],
})
export class Ui2SectionLabelComponent {
  readonly color = input<string>('var(--ink-500)');
  readonly action = input<string | null>(null);
  readonly actionClick = output<void>();
}
