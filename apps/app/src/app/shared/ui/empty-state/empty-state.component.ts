import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

@Component({
  selector: 'ui-empty-state',
  standalone: true,
  imports: [],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) title!: string;
  @Input() message?: string;
  @Input() actionLabel?: string;
  @Input() actionIcon = 'add';

  @Output() action = new EventEmitter<void>();
}
