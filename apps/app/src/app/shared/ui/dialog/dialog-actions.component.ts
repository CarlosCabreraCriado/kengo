import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-dialog-actions',
  standalone: true,
  imports: [],
  template: `
    <div class="ui-dialog-actions" [class]="alignmentClasses">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .ui-dialog-actions {
      display: flex;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-top: 1px solid #f3f4f6;
      background-color: #fafafa;
    }
  `]
})
export class DialogActionsComponent {
  @Input() align: 'start' | 'center' | 'end' | 'between' = 'end';

  get alignmentClasses(): string {
    const alignments = {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between'
    };
    return alignments[this.align];
  }
}
