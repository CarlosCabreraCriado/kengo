import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  Ui2CardComponent,
  Ui2IconBadgeComponent,
} from '../../../../../shared/ui-v2';

export interface MiClinicaInfoField {
  label: string;
  value: string | null;
  mono?: boolean;
  icon?: string;
}

@Component({
  selector: 'app-mc-info-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Ui2CardComponent, Ui2IconBadgeComponent],
  templateUrl: './info-card.component.html',
  styleUrl: './info-card.component.css',
})
export class MiClinicaInfoCardComponent {
  readonly icon = input.required<string>();
  readonly iconColor = input<string>('var(--kengo-primary)');
  readonly title = input.required<string>();
  readonly fields = input.required<MiClinicaInfoField[]>();
}
