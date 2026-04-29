import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Ui2SectionLabelComponent } from '../section-label/section-label.component';

/**
 * Wrapper de sección — padding lateral 20px + label opcional + slot de contenido.
 */
@Component({
  selector: 'ui2-section',
  standalone: true,
  imports: [Ui2SectionLabelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ui2-section" [style.padding]="padding()">
      @if (label()) {
        <ui2-section-label
          [action]="action()"
          (actionClick)="actionClick.emit()"
        >{{ label() }}</ui2-section-label>
      }
      <ng-content></ng-content>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .ui2-section { display: block; }
  `],
})
export class Ui2SectionComponent {
  readonly label = input<string | null>(null);
  readonly action = input<string | null>(null);
  readonly padding = input<string>('4px 20px 14px');
  readonly actionClick = output<void>();
}
