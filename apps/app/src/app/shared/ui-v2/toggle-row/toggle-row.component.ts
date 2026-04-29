import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Ui2ListRowComponent } from '../list-row/list-row.component';
import { Ui2ToggleComponent } from '../toggle/toggle.component';

/**
 * Toggle row V2 — especialización de ui2-list-row con un ui2-toggle como trailing.
 */
@Component({
  selector: 'ui2-toggle-row',
  standalone: true,
  imports: [Ui2ListRowComponent, Ui2ToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui2-list-row
      [icon]="icon()"
      [iconColor]="iconColor()"
      [title]="title()"
      [subtitle]="subtitle()"
      [isFirst]="isFirst()"
    >
      <ui2-toggle
        [checked]="checked()"
        [ariaLabel]="title()"
        (valueChange)="valueChange.emit($event)"
      ></ui2-toggle>
    </ui2-list-row>
  `,
})
export class Ui2ToggleRowComponent {
  readonly icon = input<string | null>(null);
  readonly iconColor = input<string>('var(--kengo-primary)');
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly isFirst = input<boolean>(true);
  readonly checked = input<boolean>(false);
  readonly valueChange = output<boolean>();
}
