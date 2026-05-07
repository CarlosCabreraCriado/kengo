import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../../../core/auth/services/session.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import {
  Ui2BigTitleComponent,
  Ui2CtaBarComponent,
  Ui2SegmentedComponent,
  Ui2ButtonComponent,
  type Ui2SegmentedOption,
} from '../../../../shared/ui-v2';
import { CrearClinicaDialogComponent } from '../../../clinica/components/crear-clinica-dialog/crear-clinica-dialog.component';
import { VincularClinicaDialogComponent } from '../../../clinica/components/vincular-clinica-dialog/vincular-clinica-dialog.component';

type ModoOnboarding = 'fisio' | 'paciente';

@Component({
  standalone: true,
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2BigTitleComponent,
    Ui2CtaBarComponent,
    Ui2SegmentedComponent,
    Ui2ButtonComponent,
    CrearClinicaDialogComponent,
    VincularClinicaDialogComponent,
  ],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css',
})
export class OnboardingComponent {
  private sessionService = inject(SessionService);
  private authService = inject(AuthService);
  private router = inject(Router);

  protected readonly modo = signal<ModoOnboarding>('fisio');
  protected readonly mostrarCrearClinica = signal(false);
  protected readonly mostrarVincular = signal(false);

  protected readonly nombre = computed(
    () => this.sessionService.usuario()?.first_name ?? '',
  );

  protected readonly opcionesModo: Ui2SegmentedOption[] = [
    { id: 'fisio', label: 'Soy fisio' },
    { id: 'paciente', label: 'Soy paciente' },
  ];

  protected onModoChange(id: string): void {
    if (id === 'fisio' || id === 'paciente') {
      this.modo.set(id);
    }
  }

  protected abrirCrearClinica(): void {
    this.mostrarCrearClinica.set(true);
  }
  protected cerrarCrearClinica(): void {
    this.mostrarCrearClinica.set(false);
  }

  protected abrirVincular(): void {
    this.mostrarVincular.set(true);
  }
  protected cerrarVincular(): void {
    this.mostrarVincular.set(false);
  }

  protected async onClinicaCreada(): Promise<void> {
    this.cerrarCrearClinica();
    await this.sessionService.refreshUsuario();
    this.router.navigate(['/inicio']);
  }

  protected async onVinculacionExitosa(): Promise<void> {
    this.cerrarVincular();
    await this.sessionService.refreshUsuario();
    this.router.navigate(['/inicio']);
  }

  protected async cerrarSesion(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
