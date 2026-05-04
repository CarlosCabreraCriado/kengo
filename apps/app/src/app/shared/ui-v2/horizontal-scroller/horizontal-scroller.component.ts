import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Ui2SectionLabelComponent } from '../section-label/section-label.component';

/**
 * Horizontal scroller V2 — header (label + acción) + flex overflow-x con padding 20px lateral.
 * Full-bleed: el header tiene 20px lateral pero el carrusel "escapa" para permitir tiles más allá.
 */
@Component({
  selector: 'ui2-horizontal-scroller',
  standalone: true,
  imports: [Ui2SectionLabelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-h-scroll">
      @if (label()) {
        <div class="ui2-h-scroll__head">
          <ui2-section-label
            [action]="action()"
            (actionClick)="actionClick.emit()"
          >{{ label() }}</ui2-section-label>
        </div>
      }
      <div class="ui2-h-scroll__rail">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-h-scroll { padding: 4px 0 14px; }
    .ui2-h-scroll__head { padding: 0 20px; }
    .ui2-h-scroll__rail {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding: 0 20px 4px;
      scrollbar-width: none;
    }
    .ui2-h-scroll__rail::-webkit-scrollbar { display: none; }
  `],
})
export class Ui2HorizontalScrollerComponent {
  readonly label = input<string | null>(null);
  readonly action = input<string | null>(null);
  readonly actionClick = output<void>();
}
