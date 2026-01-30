import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-dialog-container',
  standalone: true,
  imports: [],
  template: `
    <div class="ui-dialog" [class]="dialogClasses">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .ui-dialog {
      display: flex;
      flex-direction: column;
      max-height: inherit;
      overflow: hidden;
    }
  `]
})
export class DialogContainerComponent {
  @Input() maxHeight?: string;

  get dialogClasses(): string {
    return 'bg-white rounded-2xl shadow-2xl w-full overflow-hidden';
  }
}
