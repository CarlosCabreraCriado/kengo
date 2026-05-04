import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  Ui2AvatarComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2IconBadgeComponent,
} from '../../../../../shared/ui-v2';
import { Usuario } from '../../../../../../types/global';
import { MiClinicaTeamMemberCardComponent } from './team-member-card.component';

@Component({
  selector: 'app-mc-team-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2CardComponent,
    Ui2IconBadgeComponent,
    Ui2ButtonComponent,
    Ui2AvatarComponent,
    MiClinicaTeamMemberCardComponent,
  ],
  templateUrl: './team-grid.component.html',
  styleUrl: './team-grid.component.css',
})
export class MiClinicaTeamGridComponent {
  readonly fisios = input.required<Usuario[]>();
  readonly puedeAnadirFisio = input<boolean>(false);
  readonly expandable = input<boolean>(false);
  readonly expanded = input<boolean>(true);
  readonly avatarUrlFn = input<(avatar: string | null | undefined) => string | null>(
    () => null,
  );
  readonly esAdminFn = input<(fisioId: string) => boolean>(() => false);

  readonly anadirFisio = output<void>();
  readonly toggleExpand = output<void>();

  resolveAvatar(avatar: string | null | undefined): string | null {
    return this.avatarUrlFn()(avatar);
  }

  esAdminFisio(id: string): boolean {
    return this.esAdminFn()(id);
  }

  preview(): Usuario[] {
    return this.fisios().slice(0, 4);
  }

  extras(): number {
    return Math.max(0, this.fisios().length - 4);
  }
}
