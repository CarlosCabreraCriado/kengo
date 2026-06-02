import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { DialogService } from '../../../../shared/services/dialog/dialog.service';
import type { CrearClinicaDialogComponent } from '../../../clinica/components/crear-clinica-dialog/crear-clinica-dialog.component';
import type { VincularClinicaDialogComponent } from '../../../clinica/components/vincular-clinica-dialog/vincular-clinica-dialog.component';

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
  ],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css',
})
export class OnboardingComponent {
  private sessionService = inject(SessionService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private destroyRef = inject(DestroyRef);

  protected readonly modo = signal<ModoOnboarding>('fisio');

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

  protected async abrirCrearClinica(): Promise<void> {
    const { CrearClinicaDialogComponent } = await import(
      '../../../clinica/components/crear-clinica-dialog/crear-clinica-dialog.component'
    );
    const ref = this.dialogService.openForm<CrearClinicaDialogComponent, undefined, boolean>(
      CrearClinicaDialogComponent,
    );
    ref.closed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async success => {
        if (success) {
          await this.sessionService.refreshUsuario();
          this.router.navigate(['/inicio']);
        }
      });
  }

  protected async abrirVincular(): Promise<void> {
    const { VincularClinicaDialogComponent } = await import(
      '../../../clinica/components/vincular-clinica-dialog/vincular-clinica-dialog.component'
    );
    const ref = this.dialogService.openForm<VincularClinicaDialogComponent, undefined, boolean>(
      VincularClinicaDialogComponent,
    );
    ref.closed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async success => {
        if (success) {
          await this.sessionService.refreshUsuario();
          this.router.navigate(['/inicio']);
        }
      });
  }

  protected async cerrarSesion(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
