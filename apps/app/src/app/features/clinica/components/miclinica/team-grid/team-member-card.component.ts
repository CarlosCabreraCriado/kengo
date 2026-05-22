import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  Ui2AvatarComponent,
  Ui2AvatarGradient,
} from '../../../../../shared/ui-v2';
import { Usuario } from '../../../../../../types/global';

const GRADIENTS: readonly Ui2AvatarGradient[] = ['coral', 'indigo', 'green', 'amber'] as const;

@Component({
  selector: 'app-mc-team-member-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Ui2AvatarComponent],
  templateUrl: './team-member-card.component.html',
  styleUrl: './team-member-card.component.css',
})
export class MiClinicaTeamMemberCardComponent {
  readonly fisio = input.required<Usuario>();
  readonly index = input<number>(0);
  readonly avatarUrl = input<string | null>(null);
  readonly esAdmin = input<boolean>(false);

  readonly abrir = output<void>();

  readonly fullName = computed(() => {
    const f = this.fisio();
    return `${f.first_name ?? ''} ${f.last_name ?? ''}`.trim();
  });

  readonly rol = computed(() => (this.esAdmin() ? 'Fisioterapeuta · Admin' : 'Fisioterapeuta'));

  readonly gradient = computed<Ui2AvatarGradient>(
    () => GRADIENTS[this.index() % GRADIENTS.length]!,
  );
}
