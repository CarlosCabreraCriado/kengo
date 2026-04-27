import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { Usuario } from '../../../../../../../types/global';

@Component({
  selector: 'app-paciente-hero-card',
  standalone: true,
  templateUrl: './paciente-hero-card.component.html',
  styleUrl: './paciente-hero-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacienteHeroCardComponent {
  readonly paciente = input<Usuario | null>(null);
  readonly fullName = input<string>('');
  readonly avatarUrl = input<string | null>(null);
  readonly clinicaNombre = input<string | null>(null);
  readonly fisioResponsableNombre = input<string | null>(null);
  readonly isMobile = input<boolean>(false);

  readonly editarPaciente = output<void>();
  readonly gestionarAcceso = output<void>();
  readonly crearPlan = output<void>();
  readonly volver = output<void>();
}
