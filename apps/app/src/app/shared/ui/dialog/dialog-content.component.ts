import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-dialog-content',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ui-dialog-content" [class.no-padding]="noPadding">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .ui-dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem;
    }

    .ui-dialog-content.no-padding {
      padding: 0;
    }
  `]
})
export class DialogContentComponent {
  @Input() noPadding = false;
}
